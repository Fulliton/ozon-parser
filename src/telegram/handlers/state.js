/**
 * Simple in-memory user interaction state
 * Structure: Map<userId, { type: string, productId: number, createdAt: number }>
 */
const userStates = new Map();

function setUserState(userId, data) {
  userStates.set(Number(userId), { ...data, createdAt: Date.now() });
}

function getUserState(userId) {
  const state = userStates.get(Number(userId));
  if (!state) return null;
  // Expire states older than 15 minutes
  if (Date.now() - state.createdAt > 15 * 60 * 1000) {
    userStates.delete(Number(userId));
    return null;
  }
  return state;
}

function clearUserState(userId) {
  userStates.delete(Number(userId));
}

module.exports = {
  setUserState,
  getUserState,
  clearUserState,
};
