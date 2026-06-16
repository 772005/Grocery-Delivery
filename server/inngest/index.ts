import { cron, Inngest } from "inngest";
import { prisma } from "../config/prisma.js";
import sendEmail from "../config/nodemailer.js";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "grocery-delivery" });

const LOW_STOCK_THRESHOLD = 10;

// low stock alert to admin email
const checkLowStock = inngest.createFunction(
  {
    id: "check-low-stock",
    name: "Low Stock Alert",
    triggers: [{ event: "inventory/stock.updated" }]
  },
  async ({ event, step }) => {
    const { productId } = event.data;

    // Fetch product details from your database using productId
    const product = await step.run("fetch-product", async () => {
      return await prisma.product.findUnique({ where: { id: productId } });
    });

    if (!product || product.stock === null || product.stock >= LOW_STOCK_THRESHOLD) {
      return { skipped: true, stock: product?.stock ?? null };
    }

    await step.run("send-low-stock-email", async () => {
      // Implementation for sending low stock email
      const adminEmails = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.split(",").map(e => e.trim()) : [];
      if (adminEmails.length === 0) {
        return { skipped: true, reason: "No admin emails configured" };
      }
      await sendEmail({
        to: adminEmails.join(","),
        subject: `Low Stock Alert: ${product.name}`,
        body: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: auto; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #dc2626, #ef4444); padding: 24px 28px;">
            <h2 style="color: #fff; margin: 0; font-size: 20px;">Low Stock Alert</h2>
        </div>
        <div style="padding: 28px;">
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 20px;">
                ${product.image ? `<img src="${product.image}" alt="${product.name}" style="width: 64px; height: 64px; border-radius: 12px; object-fit: cover;" />` : ""}
                <div>
                    <h3 style="margin: 0 0 4px; font-size: 18px; color: #111827;">${product.name}</h3>
                    <p style="margin: 0; font-size: 14px; color: #6b7280;">${product.category} • ${product.unit}</p>
                </div>
            </div>
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; text-align: center;">
                <p style="margin: 0 0 4px; font-size: 13px; color: #991b1b; font-weight: 600;">CURRENT STOCK</p>
                <p style="margin: 0; font-size: 32px; font-weight: 700; color: #dc2626;">${product.stock}</p>
                <p style="margin: 4px 0 0; font-size: 12px; color: #6b7280;">units remaining</p>
            </div>
            <p style="margin: 20px 0 0; font-size: 13px; color: #9ca3af; text-align: center;">Please restock this item as soon as possible.</p>
        </div>
    </div>`
      });
    });
    return { alerted: true, product: product.name, stock: product.stock }
  }
);

// Monthly offers Email (1st of every month - payroll day)
const sendMonthlyOffers = inngest.createFunction(
  {
    id: "send-monthly-offers",
    name: "Monthly Payday offers",
    triggers: [cron("0 10 1 * *")] // Every 1st of the month at 9:00 AM and 10:00 AM
  },
  async ({ step }) => {
    // Fetch all users and send them monthly offers email
    const { deals, users } = await step.run("fetch-deals-and-users", async () => {
      // get top discounted products as offers
      const deals = await prisma.product.findMany({
        where: { stock: { gt: 0 } },
        orderBy: { originalPrice: "desc" },
        take: 6,
      });

      const allUsers = await prisma.user.findMany({
        select: { name: true, email: true }
      });
      return { deals, users: allUsers };
    });

    if (users.length === 0 || deals.length === 0) {
      return { skipped: true, reason: "No subscribed users or available deals" };
    }

    let sentCount = 0;

    // send in a batches of 10 to avoid overwhelming mail server and hitting rate limits
    const batchSize = 10;
    for (let i = 0; i < users.length; i += batchSize) {
      const batchUsers = users.slice(i, i + batchSize);

      await step.run(`send-offers-batch-${i}`, async () => {
        for (const u of batchUsers) {
          await sendEmail({
            to: u.email,
            subject: `Exclusive Monthly Offers Just for You, ${u.name}!`,
            body: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: auto; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden;">
                
            <div style="background: linear-gradient(135deg, #f97316, #fb923c); padding: 24px 28px;">
                <h2 style="color: #fff; margin: 0; font-size: 20px;">Fresh Picks Just For You!</h2>
                <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 13px;">
                    Exclusive offers to kick off your month right
                </p>
            </div>

            <div style="padding: 28px;">
                <p style="margin: 0 0 20px; font-size: 15px; color: #374151;">
                    Hi <strong>${u.name}</strong>, check out this month's top picks!
                </p>

                <table width="100%" cellpadding="0" cellspacing="0">
                    ${deals
                .reduce((rows: any, _: any, idx: number) => {
                  if (idx % 3 === 0) {
                    rows.push(deals.slice(idx, idx + 3));
                  }
                  return rows;
                }, [])
                .map(
                  (row: any) => `
                            <tr>
                                ${row
                      .map(
                        (p: any) => `
                                        <td style="width: 33%; padding: 8px; vertical-align: top;">
                                            <div style="border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; text-align: center;">
                                                ${p.image ? `<img src="${p.image}" alt="${p.name}" style="width: 100%; height: 100px; object-fit: cover;" />` : ""}
                                                <div style="padding: 10px;">
                                                    <p style="margin: 0; font-size: 13px; font-weight: 600; color: #111827;">
                                                        ${p.name}
                                                    </p>
                                                    <p style="margin: 4px 0 0; font-size: 15px; font-weight: 700; color: #16a34a;">
                                                        $${p.price.toFixed(2)}
                                                        ${p.originalPrice > p.price ? `<span style="font-size: 11px; color: #9ca3af; text-decoration: line-through; margin-left: 4px;">$${p.originalPrice.toFixed(2)}</span>` : ""}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>`
                      )
                      .join("")}
                            </tr>`
                )
                .join("")}
                </table>

                <div style="text-align: center; margin-top: 24px;">
                    <a href="${process.env.CLIENT_URL || "http://localhost:5173"}/products"
                       style="display: inline-block; background: #16a34a; color: #fff; padding: 12px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 14px;">
                       Shop All Deals →
                    </a>
                </div>
            </div>
        </div>`
          });
        }
      });

      sentCount += batchUsers.length;
    }
    return { sent: sentCount };
  }
);

// auto-assign rider after 5 mins
const autoAssignRider = inngest.createFunction(
  {
    id: "auto-assign-rider",
    name: "Auto-assign Delivery Rider",
    triggers: [{event: "order/placed"}]
  },
  async ({ event, step }) => {
    const { orderId } = event.data;

    // Wait for 5 minutes to see if order is assigned
    await step.sleep("wait-5-min", '5m');
    
    const result = await step.run("assign-rider", async () => {
      // Fetch order details from your database using orderId
      const order = await prisma.order.findUnique({ where: { id: orderId }});

      // skip if order doesnot exist, already assigned or cancelled
      if (!order) {
        return { skipped: true, reason: "Order not found" };
      }

      if (order.deliveryPartnerId) {
        return { skipped: true, reason: "Already assigned" };
      }

      if (['Cancelled', 'Delivered'].includes(order.status as string)) {
        return { skipped: true, reason: 'Order is ${order.status}' };
      }

      // find an active rider not currently delivering an order
      const busyOrders = await prisma.order.findMany({
        where: {
          deliveryPartnerId: { not: null },
          status: { in: ['Assigned','Out for Delivery'] }
        },
        select: { deliveryPartnerId: true }
      });
      const busyRiderIds = busyOrders.map(o => o.deliveryPartnerId);

      const availableRider = await prisma.deliveryPartner.findFirst({
        where: {
          id: { notIn: busyRiderIds as string[] },
          isActive: true
        }
      });

      if (!availableRider) {
        return { skipped: true, reason: "No available riders at the moment" };
      }

      // Generate a random 6-digit OTP for delivery confirmation
      const otp = Math.floor(100000 + Math.random() * 900000);
      toString();

      const history = (Array.isArray(order.statusHistory) ? order.statusHistory : []) as any[]
      history.push({
        status: "Assigned",
        timestamp: new Date(),
        note: `Auto-assigned to ${availableRider.name} (${availableRider.id})`
      });

      await prisma.order.update({
        where: { id: orderId },
        data: {
          deliveryPartnerId: availableRider.id,
          status: "Assigned",
          statusHistory: history,
          deliveryOtp: otp.toString()
        }
      });
      return { assigned: true, riderId: availableRider.id ,riderName: availableRider.name, orderId:orderId };
  }
);
return result;
  })


// Create an array where we'll export future Inngest functions
export const functions = [checkLowStock, sendMonthlyOffers, autoAssignRider];