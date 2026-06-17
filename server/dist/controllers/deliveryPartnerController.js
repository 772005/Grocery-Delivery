import { prisma } from "../config/prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
const generateToken = (id) => {
    return jwt.sign({ id, role: 'delivery' }, process.env.JWT_SECRET, { expiresIn: "30d" });
};
// login delivery partner
// post /api/delivery/login
export const loginPartner = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: " Please provide email and password" });
    }
    const partner = await prisma.deliveryPartner.findUnique({
        where: {
            email: email.toLowerCase()
        }
    });
    if (!partner) {
        return res.status(401).json({ message: "Invalid email or password" });
    }
    if (!partner.isActive) {
        return res.status(403).json({ message: "Your account is not active. Please contact support." });
    }
    const isMatch = await bcrypt.compare(password, partner.password);
    if (!isMatch) {
        return res.status(401).json({ message: "Invalid email or password" });
    }
    const token = generateToken(partner.id);
    const { password: _, ...partnerData } = partner;
    res.json({ partner: partnerData, token });
};
// get assigned deliveries for a delivery partner
// get /api/delivery/my-deliveries
export const getMyDeliveries = async (req, res) => {
    const { status } = req.query;
    const where = { deliveryPartnerId: req.partner.id };
    if (status === "active") {
        where.status = { in: ["Assigned", "Placed", "Out for Delivery"] };
    }
    else if (status === "completed") {
        where.status = { in: ["Delivered", "Cancelled"] };
    }
    const orders = await prisma.order.findMany({
        where,
        include: {
            user: {
                select: {
                    name: true,
                    email: true,
                    phone: true
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });
    res.json({ orders });
};
// get single delivery details for a delivery partner
// get /api/delivery/my-deliveries/:id
export const getDeliveryDetails = async (req, res) => {
    const order = await prisma.order.findFirst({
        where: {
            id: req.params.id,
            deliveryPartnerId: req.partner.id
        },
        include: {
            user: {
                select: {
                    name: true,
                    email: true,
                    phone: true
                }
            }
        }
    });
    if (!order) {
        return res.status(404).json({ message: "Delivery not found" });
    }
    res.json({ order });
};
// COMPLETE DELIVERY
// put /api/delivery/MY-DELIVERIES/:id/COMPLETE
export const completeDelivery = async (req, res) => {
    const { otp } = req.body;
    const order = await prisma.order.findFirst({
        where: {
            id: req.params.id,
            deliveryPartnerId: req.partner.id
        }
    });
    if (!order || order.status === "Cancelled" || order.status === "Delivered") {
        return res.status(400).json({ message: "Invalid delivery request" });
    }
    if (order.deliveryOtp !== otp) {
        return res.status(500).json({ message: "Invalid OTP" });
    }
    const history = order.statusHistory;
    history.push({ status: "Delivered", note: "Delivered by partner", timestamp: new Date() });
    const updatedOrder = await prisma.order.update({
        where: {
            id: order.id
        },
        data: {
            status: "Delivered",
            statusHistory: history,
            deliveryOtp: ""
        }
    });
    res.json({ order: updatedOrder, message: "Delivery marked as completed successfully" });
};
// cancelled delivery
// PUT /api/delivery/my-deliveries/:id/cancel
export const cancelDelivery = async (req, res) => {
    const { reason } = req.body;
    const order = await prisma.order.findFirst({
        where: {
            id: req.params.id,
            deliveryPartnerId: req.partner.id
        }
    });
    if (order.status === "Delivered") {
        return res.status(400).json({ message: "cannot cancel a delivery order" });
    }
    const history = order.statusHistory;
    history.push({ status: "Cancelled", note: reason || "", timestamp: new Date() });
    const updatedOrder = await prisma.order.update({
        where: {
            id: order.id
        },
        data: {
            status: "Cancelled",
            statusHistory: history
        }
    });
    res.json({ order: updatedOrder, message: "Delivery marked as cancelled successfully" });
};
// update order status
// put /api/delivery/my-deliveries/:id/status
export const updateDeliveryStatus = async (req, res) => {
    const { status } = req.body;
    const allowedStatuses = ['Packed', "Out for Delivery"];
    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status update" });
    }
    const order = await prisma.order.findFirst({
        where: {
            id: req.params.id,
            deliveryPartnerId: req.partner.id
        }
    });
    const history = order.statusHistory;
    history.push({ status: status, note: `status updated to ${status}`, timestamp: new Date() });
    const updatedOrder = await prisma.order.update({
        where: {
            id: order.id
        },
        data: {
            status: status,
            statusHistory: history
        }
    });
    res.json({ order: updatedOrder, message: "Delivery status updated successfully" });
};
// update the live location of the delivery partner
// put /api/delivery/my-deliveries/:id/location
export const updateDeliveryLocation = async (req, res) => {
    const { lat, lng } = req.body;
    const order = await prisma.order.findFirst({
        where: {
            id: req.params.id,
            deliveryPartnerId: req.partner.id,
            status: { in: ["Assigned", "Packed", "Out for Delivery"] }
        }
    });
    await prisma.deliveryPartner.update({
        where: {
            id: req.partner.id
        },
        data: {
            liveLocation: {
                lat,
                lng,
                updatedAt: new Date()
            }
        }
    });
    res.json({ success: true, message: "Live location updated successfully" });
};
