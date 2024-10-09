import mongoose from "mongoose";

const subscriptionSchema = new Schema({
    subscriber : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "User"
    },
    channel : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "User"
    }
});

const Subscription = mongoose.model('Subscription', subscriptionSchema);
export { Subscription };