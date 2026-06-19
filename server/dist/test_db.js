import { prisma } from "./config/prisma.js";
async function main() {
    console.log("Running getAdminStats queries...");
    const [totalOrders, totalUsers, totalProducts, outOfStock, totalPartners, recentOrders] = await Promise.all([
        prisma.order.count({ where: { NOT: [{ paymentMethod: "card", isPaid: false }] } }),
        prisma.user.count(),
        prisma.product.count(),
        prisma.product.count({ where: { stock: 0 } }),
        prisma.deliveryPartner.count(),
        prisma.order.findMany({
            where: { NOT: [{ paymentMethod: "card", isPaid: false }] },
            orderBy: { createdAt: 'desc' },
            take: 8,
            include: {
                user: { select: { name: true, email: true } },
                deliveryPartner: { select: { name: true, phone: true } }
            },
        }),
    ]);
    console.log({
        totalOrders,
        totalUsers,
        totalProducts,
        outOfStock,
        totalPartners,
        recentOrdersLength: recentOrders.length
    });
}
main()
    .catch((err) => {
    console.error("Queries failed:", err);
})
    .finally(async () => {
    await prisma.$disconnect();
});
