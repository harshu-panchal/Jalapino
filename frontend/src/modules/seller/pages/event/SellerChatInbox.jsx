import React, { useState, useEffect, useRef } from 'react';
import { getStoredAuthToken } from '@core/utils/authStorage';
import axiosInstance from '@core/api/axios';
import { getOrderSocket } from '@/core/services/orderSocket';
import SendIcon from '@mui/icons-material/Send';
import CircularProgress from '@mui/material/CircularProgress';
import { format } from 'date-fns';

const SellerChatInbox = () => {
    const [chats, setChats] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const socketRef = useRef(null);
    const chatEndRef = useRef(null);

    const selectedRoomRef = useRef(null);
    const chatsRef = useRef([]);
    useEffect(() => { chatsRef.current = chats; }, [chats]);

    // Fetch chat list (from DB)
    const fetchChats = async () => {
        try {
            const res = await axiosInstance.get('/chats/seller/sessions');
            if (res.data?.status) {
                setChats((res.data.result || []).filter(c => c?.customer?._id)); // skip chats of deleted customers
            }
        } catch (error) {
            console.error('Failed to fetch chats:', error);
        } finally {
            setIsLoading(false);
        }
    };
    useEffect(() => {
        fetchChats();
    }, []);

    useEffect(() => {
        selectedRoomRef.current = selectedChat ? `seller_chat_${selectedChat.seller}_${selectedChat.customer._id}` : null;
    }, [selectedChat]);

    // Socket Connection (realtime)
    useEffect(() => {
        const token = getStoredAuthToken('auth_seller');
        const socket = token ? getOrderSocket(token) : null;
        if (!socket) return undefined;
        socketRef.current = socket;

        // Messages of the open chat only.
        const onChatMessage = (msg) => {
            if (msg?.room && msg.room !== selectedRoomRef.current) return;
            setMessages(prev => [...prev, msg]);
            // Keep the sidebar in sync with the seller's own replies.
            if (msg?.sender === 'seller' && msg?.sessionId) {
                setChats(prev => prev.map(c => String(c._id) === String(msg.sessionId)
                    ? { ...c, messages: [...(c.messages || []), msg], lastMessageAt: msg.createdAt || new Date().toISOString() }
                    : c));
            }
        };
        // Any new customer message (even when that chat is not open): move it to the top.
        const onInboxUpdate = (msg) => {
            // A brand-new customer chat: reload the list from DB.
            if (!chatsRef.current.some(c => String(c._id) === String(msg?.sessionId))) {
                fetchChats();
                return;
            }
            setChats(prev => {
                const idx = prev.findIndex(c => String(c._id) === String(msg?.sessionId));
                if (idx === -1) return prev;
                const updated = { ...prev[idx], messages: [...(prev[idx].messages || []), msg], lastMessageAt: msg.createdAt || new Date().toISOString() };
                return [updated, ...prev.filter((_, i) => i !== idx)];
            });
        };

        socket.on('chat_message', onChatMessage);
        socket.on('chat_inbox_update', onInboxUpdate);
        return () => {
            socket.off('chat_message', onChatMessage);
            socket.off('chat_inbox_update', onInboxUpdate);
            if (selectedRoomRef.current) socket.emit('leave_room', selectedRoomRef.current);
        };
    }, []);

    // Handle Chat Selection
    const handleSelectChat = async (chat) => {
        if (selectedChat) {
            socketRef.current?.emit('leave_room', `seller_chat_${selectedChat.seller}_${selectedChat.customer._id}`);
        }
        
        setSelectedChat(chat);
        setMessages(chat.messages || []);

        // Join room specific to seller and this customer
        const roomName = `seller_chat_${chat.seller}_${chat.customer._id}`;
        socketRef.current?.emit('join_room', roomName);

        // Mark as read API call
        try {
            await axiosInstance.post(`/chats/session/${chat._id}/read`);
        } catch(e) {}
    };

    // Auto-scroll
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        if (!input.trim() || !selectedChat) return;

        const roomName = `seller_chat_${selectedChat.seller}_${selectedChat.customer._id}`;
        
        if (socketRef.current) {
            socketRef.current.emit('send_chat_message', {
                room: roomName,
                text: input,
                senderId: 'seller',
                customerId: selectedChat.customer._id,
                sellerId: selectedChat.seller
            });
        }
        
        setInput('');
    };

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <CircularProgress />
            </div>
        );
    }

    return (
        <div className="h-[calc(100dvh-140px)] md:h-[calc(100vh-100px)] min-h-[420px] flex border border-slate-200 rounded-2xl md:rounded-3xl overflow-hidden bg-white shadow-sm mt-2 md:mt-4">
            {/* Sidebar List (mobile: shown until a chat is opened) */}
            <div className={`${selectedChat ? 'hidden md:flex' : 'flex'} w-full md:w-1/3 md:min-w-[260px] border-r border-slate-200 flex-col bg-slate-50`}>
                <div className="p-4 md:p-5 border-b border-slate-200 bg-white">
                    <h2 className="text-lg font-black text-slate-800">Customer Inquiries</h2>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {chats.length === 0 ? (
                        <div className="p-5 text-center text-sm text-slate-500 font-medium">No active chats</div>
                    ) : (
                        chats.map(chat => (
                            <div 
                                key={chat._id}
                                onClick={() => handleSelectChat(chat)}
                                className={`p-4 border-b border-slate-100 cursor-pointer transition-colors ${
                                    selectedChat?._id === chat._id ? 'bg-purple-50 border-l-4 border-l-purple-600' : 'hover:bg-white bg-transparent'
                                }`}
                            >
                                <div className="flex justify-between items-start gap-2 mb-1">
                                    <h4 className="font-bold text-slate-800 text-sm truncate">{chat.customer?.name || 'Customer'}</h4>
                                    <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                                        {format(new Date(chat.lastMessageAt), 'MMM dd, h:mm a')}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 truncate">
                                    {chat.messages && chat.messages.length > 0 
                                        ? chat.messages[chat.messages.length - 1].text 
                                        : 'No messages yet'}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <div className={`${selectedChat ? 'flex' : 'hidden md:flex'} flex-1 min-w-0 flex-col bg-[#f8fafc]`}>
                {selectedChat ? (
                    <>
                        {/* Header */}
                        <div className="px-3 md:px-6 py-3 md:py-4 border-b border-slate-200 bg-white flex justify-between items-center gap-2 shadow-sm z-10">
                            <div className="flex items-center gap-2 min-w-0">
                                {/* Mobile: back to the customer list */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (selectedRoomRef.current) socketRef.current?.emit('leave_room', selectedRoomRef.current);
                                        setSelectedChat(null);
                                        setMessages([]);
                                    }}
                                    className="md:hidden w-9 h-9 shrink-0 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600 text-xl font-bold"
                                    aria-label="Back to inquiries"
                                >
                                    ←
                                </button>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-slate-800 truncate">{selectedChat.customer?.name || 'Customer'}</h3>
                                    <p className="text-xs text-slate-500">Plan My Event Inquiry</p>
                                </div>
                            </div>
                            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full shrink-0">Active</span>
                        </div>

                        {/* Messages Board */}
                        <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-4">
                            {messages.map((msg, idx) => {
                                const isSeller = msg.sender === 'seller';
                                return (
                                    <div key={idx} className={`flex flex-col ${isSeller ? 'items-end' : 'items-start'}`}>
                                        <div 
                                            className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-2.5 text-sm font-medium shadow-sm leading-relaxed whitespace-pre-line break-words
                                                ${isSeller 
                                                    ? 'bg-purple-600 text-white rounded-tr-none' 
                                                    : 'bg-white text-slate-700 border border-slate-200 rounded-tl-none'
                                                }`}
                                        >
                                            {msg.text}
                                        </div>
                                        <span className="text-[10px] text-slate-400 mt-1.5 px-1 font-semibold">
                                            {format(new Date(msg.createdAt || Date.now()), 'h:mm a')}
                                        </span>
                                    </div>
                                );
                            })}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-2 md:p-4 bg-white border-t border-slate-200">
                            <div className="flex gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-2 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500 transition-all">
                                <input 
                                    type="text" 
                                    placeholder="Type your reply to customer..."
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                    className="flex-1 bg-transparent px-3 outline-none text-sm"
                                />
                                <button 
                                    onClick={handleSend}
                                    disabled={!input.trim()}
                                    className="w-10 h-10 rounded-xl bg-purple-600 disabled:bg-purple-300 text-white flex items-center justify-center hover:bg-purple-700 transition-colors"
                                >
                                    <SendIcon sx={{ fontSize: 18 }} />
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-4">
                        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                            <SendIcon sx={{ fontSize: 24, color: '#94a3b8' }} />
                        </div>
                        <p className="font-semibold text-sm">Select a customer inquiry to start chatting</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SellerChatInbox;
