import express from "express";
import { 
    loginPartner, 
    getMyDeliveries, 
    getDeliveryDetails,
    completeDelivery,
    cancelDelivery,
    updateDeliveryStatus,
    updateDeliveryLocation
} from "../controllers/deliveryPartnerController.js";
import deliveryAuth from "../middleware/deliveryAuth.js";

const deliveryPartnerRouter = express.Router();

deliveryPartnerRouter.post("/login", loginPartner);
deliveryPartnerRouter.get("/my-deliveries", deliveryAuth, getMyDeliveries);
deliveryPartnerRouter.get("/my-deliveries/:id", deliveryAuth, getDeliveryDetails);
deliveryPartnerRouter.put("/my-deliveries/:id/complete", deliveryAuth, completeDelivery);
deliveryPartnerRouter.put("/my-deliveries/:id/status", deliveryAuth, updateDeliveryStatus);
deliveryPartnerRouter.put("/my-deliveries/:id/location", deliveryAuth, updateDeliveryLocation);
deliveryPartnerRouter.put("/my-deliveries/:id/cancel", deliveryAuth, cancelDelivery);


export default deliveryPartnerRouter;