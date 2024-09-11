import mongoose from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const videoSchema = mongoose.Schema({
    videoFile : {
        type : String,
        require : true,
    },
    thumbnail : {
        type : String,
        require : true,
    },
    owner : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "User"
    },
    title : {
        type : String,
        require : true,
    },
    description : {
        type : String,
        require : true,
    },
    duration : {
        type : Number,
        required: true
    },
    views : {
        type : Number,
        default : 0
    },
    isPublished : {
        type : Boolean,
        default : true
    }

}, {timestamps : true});

videoSchema.plugin(mongooseAggregatePaginate);

const Video  = mongoose.model('Video', videoSchema);

export { Video }