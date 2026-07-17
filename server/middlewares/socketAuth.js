import jwt from "jsonwebtoken";
import User from "../models/user.js";

export const socketAuthMiddleware = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication required"));
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return next(new Error("User not found"));
    }
    socket.user = user;
    next();
  } catch (err) {
    next(new Error("Invalid token"));
  }
};
