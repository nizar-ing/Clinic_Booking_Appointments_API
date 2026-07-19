// bcrypt is used to hash passwords before storing them and to compare plain-text
// passwords against stored hashes during login — it uses a cost factor (salt rounds)
// to make brute-force attacks computationally expensive.
const bcrypt = require('bcrypt');

// Shared Prisma client instance — all DB queries go through this single object
// so we don't open a new DB connection on every request.
const prisma = require('../../config/prisma-client');

// AppError is a custom error class that carries both a human-readable message and
// an HTTP status code, allowing the global error handler to respond correctly.
const AppError = require('../../utils/AppError');

// Utility that signs a JWT with the user's id as payload and returns the token string.
const generateToken = require('../../utils/generateToken');

// ---------------------------------------------------------------------------
// Register a new patient user
// ---------------------------------------------------------------------------
const register = async ({ name, email, password }) => {
    // Look up the database for a user whose email matches the one provided.
    // findUnique throws if the record doesn't exist by default — here we capture the
    // result so we can decide whether to reject the request ourselves.
    const existingUser = await prisma.user.findUnique({ where: { email } });

    // If a record was found it means the email is already taken — reject early
    // with a 400 Bad Request before touching any sensitive operation.
    if (existingUser) {
        throw new AppError('Email already registered.', 400);
    }

    // Hash the plain-text password with a salt round of 10.
    // Salt rounds determine how many times the hashing algorithm iterates:
    // higher = more secure but slower. 10 is the industry-standard default.
    const hashedPassword = await bcrypt.hash(password, 10);

    // Persist the new user to the database.
    // - role defaults to 'PATIENT' so self-registered users never get admin access.
    // - select limits the returned fields so the hashed password is never sent back
    //   to the caller, even accidentally.
    const user = await prisma.user.create({
        data: {
            name,
            email,
            password: hashedPassword, // store only the hash, never the plain text
            role: 'PATIENT',
        },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    // Sign a JWT for the newly created user so the client can authenticate
    // immediately after registering without a separate login step.
    const token = generateToken(user['id']);

    // Return both the sanitized user object and the token to the controller.
    return { user, token };
};

// ---------------------------------------------------------------------------
// Login user
// ---------------------------------------------------------------------------
const login = async ({ email, password }) => {
    // Fetch the full user record (including the hashed password) so we can
    // compare it. findUnique returns null when no match is found.
    const user = await prisma.user.findUnique({ where: { email } });

    // If no user exists for this email, reject with 401 Unauthorized.
    // Using the same generic message as a wrong password deliberately avoids
    // leaking whether an email account exists in the system (user enumeration).
    if (!user) {
        throw new AppError('Invalid email or password.', 401);
    }

    // bcrypt.compare hashes the incoming plain-text password with the same salt
    // that was embedded in the stored hash and checks whether they match.
    // Returns true on match, false otherwise — never throws for a mismatch.
    const isMatch = await bcrypt.compare(password, user['password']);

    // Wrong password — same generic 401 message to avoid user enumeration.
    if (!isMatch) {
        throw new AppError('Invalid email or password.', 401);
    }

    // Credentials are valid — issue a new JWT tied to this user's id.
    const token = generateToken(user['id']);

    // Return a sanitized user object (no password field) alongside the token.
    // The password hash is explicitly excluded here even though findUnique
    // returned it above, ensuring it never travels over the wire.
    return {
        user: { id: user['id'], name: user['name'], email: user['email'], role: user['role'] },
        token,
    };
};

// ---------------------------------------------------------------------------
// Get current user profile
// ---------------------------------------------------------------------------
const getMe = async (userId) => {
    // Retrieve only the safe, public fields for this user by id.
    // select prevents accidentally exposing the password hash to the API response.
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    // Guard against the edge case where the JWT is valid but the account was
    // deleted after the token was issued — return 404 instead of silently
    // returning null to the controller.
    if (!user) {
        throw new AppError('User not found.', 404);
    }

    // Return the sanitized profile object to the controller.
    return user;
};

// ---------------------------------------------------------------------------
// Update user profile (name, email)
// ---------------------------------------------------------------------------
const updateProfile = async (userId, data) => {
    // Email uniqueness check — only needed when the caller is trying to change
    // their email address, so skip it entirely when the payload has no email field.
    if (data.email) {
        // Look for any other account that already uses this email address.
        const existing = await prisma.user.findUnique({ where: { email: data.email } });

        // existing.id !== userId means the email belongs to a *different* account,
        // which is a conflict. If it matches the current user's id, they're just
        // re-submitting their own email — that's harmless, so we let it through.
        if (existing && existing['id'] !== userId) {
            throw new AppError('Email is already taken by another account.', 400);
        }
    }

    // Apply the update and return the refreshed, sanitized profile in one query.
    // select keeps the password hash out of the response.
    return await prisma.user.update({
        where: { id: userId },
        data,
        select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
};

// ---------------------------------------------------------------------------
// Change password
// ---------------------------------------------------------------------------
const changePassword = async (userId, { currentPassword, newPassword }) => {
    // Fetch the full record (including the stored hash) so we can verify
    // the current password before allowing a change.
    const user = await prisma.user.findUnique({ where: { id: userId } });

    // Protect against the same deleted-account edge case as getMe.
    if (!user) {
        throw new AppError('User not found.', 404);
    }

    // Verify the caller actually knows the existing password.
    // This prevents an attacker who hijacked a session from locking the
    // real owner out by changing the password without their knowledge.
    const isMatch = await bcrypt.compare(currentPassword, user['password']);
    if (!isMatch) {
        throw new AppError('Current password is incorrect.', 401);
    }

    // Hash the new password with the same cost factor used at registration.
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Persist only the password field — no other columns are touched.
    // We don't need a select here because the return value is discarded.
    await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
    });

    // Return a plain success message — no sensitive data needed in the response.
    return { message: 'Password changed successfully.' };
};

// Export all service functions so the auth controller can import them by name.
module.exports = { register, login, getMe, updateProfile, changePassword };
