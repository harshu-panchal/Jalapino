/**
 * Socket.IO — order rooms, role rooms, JWT auth.
 */
import { verifySocketToken } from "./socketAuth.js";
import mongoose from "mongoose";
import Ticket from "../models/ticket.js";
import EventChatSession from "../models/event/EventChatSession.js";

let _io = null;

const deliverySockets = new Map();

export const initSocket = (io) => {
  _io = io;

  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token ||
      null;
    if (!token) {
      socket.user = null;
      return next();
    }
    const user = verifySocketToken(token);
    if (!user) {
      return next(new Error("Unauthorized"));
    }
    socket.user = user;
    next();
  });

  io.on("connection", (socket) => {
    const { id: userId, role } = socket.user || {};
    if (!userId) {
      return;
    }

    if (role === "delivery") {
      const dId = userId.toString();
      deliverySockets.set(dId, socket.id);
      socket.join("delivery:online");
      socket.join(`delivery:${dId}`);
    }
    if (role === "seller") {
      socket.join(`seller:${userId}`);
    }
    if (role === "customer" || role === "user") {
      socket.join(`customer:${userId}`);
    }
    if (role === "admin") {
      socket.join("admin:orders");
      socket.join("admin:support");
      // Per-admin room — used by the notification service to push
      // `notification:new` deltas to the specific admin who owns the
      // Notification row, so the topbar can refresh without polling.
      socket.join(`admin:${userId}`);
    }

    socket.on("join_order", (orderId) => {
      if (!orderId || typeof orderId !== "string") return;
      socket.join(`order:${orderId}`);
    });

    socket.on("leave_order", (orderId) => {
      if (!orderId) return;
      socket.leave(`order:${orderId}`);
    });

    socket.on("join_ticket", async (ticketId) => {
      const raw = typeof ticketId === "string" ? ticketId.trim() : "";
      if (!raw || !mongoose.Types.ObjectId.isValid(raw)) return;

      if (socket.user?.role === "admin") {
        socket.join(`ticket:${raw}`);
        return;
      }

      try {
        const ticket = await Ticket.findById(raw).select("userId").lean();
        if (!ticket?.userId) return;
        if (ticket.userId.toString() !== userId.toString()) return;
        socket.join(`ticket:${raw}`);
      } catch {
        /* ignore */
      }
    });

    socket.on("leave_ticket", (ticketId) => {
      if (!ticketId) return;
      socket.leave(`ticket:${String(ticketId).trim()}`);
    });

    socket.on("register_delivery", (deliveryId) => {
      if (deliveryId && socket.user?.role === "delivery") {
        deliverySockets.set(deliveryId.toString(), socket.id);
      }
    });

    // Chat logic
    socket.on("join_room", (roomName) => {
      if (!roomName) return;
      socket.join(roomName);
    });

    socket.on("leave_room", (roomName) => {
      if (!roomName) return;
      socket.leave(roomName);
    });

    socket.on("send_chat_message", async (data) => {
      // data format: { room: `seller_chat_${sellerId}_${customerId}`, text: 'Hello', senderId: 'customer'/'seller', customerId, sellerId }
      const { room, text, senderId, customerId, sellerId } = data;
      if (!room || !text || !customerId || !sellerId) return;

      try {
          // Find or create chat session
          let session = await EventChatSession.findOne({
              customer: customerId,
              seller: sellerId,
              status: 'active'
          });

          if (!session) {
              session = new EventChatSession({
                  customer: customerId,
                  seller: sellerId,
                  messages: []
              });
          }

          const newMessage = {
              sender: senderId === 'seller' ? 'seller' : 'customer',
              text: text,
              isRead: false
          };

          session.messages.push(newMessage);
          session.lastMessageAt = new Date();
          await session.save();

          // Broadcast back to room
          _io.to(room).emit("chat_message", {
              ...newMessage,
              id: session.messages[session.messages.length - 1]._id,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });
      } catch (err) {
          console.error("Error saving chat message:", err);
      }
    });

    socket.on("disconnect", () => {
      for (const [id, sid] of deliverySockets.entries()) {
        if (sid === socket.id) {
          deliverySockets.delete(id);
          break;
        }
      }
    });
  });
};

export const getIO = () => {
  if (!_io) throw new Error("Socket.IO not initialized");
  return _io;
};

export const notifyDeliveryPartners = (orderData) => {
  if (!_io) return;
  _io.to("delivery:online").emit("new_order_packed", orderData);
};
