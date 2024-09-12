import { User } from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import { ApiRespnse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const registerUser = asyncHandler( async (req, res) => {
    // take input details from frontend
    // validate input (correct format and required or not)
    // check if user exists already (by email and username)
    // avatar and coverImage, file upload
    // upload files using cloudinary and multer
    // create user object, store data in db
    // remove password and refresh token from response
    // check if user is created in db
    // return res

    const { username, email, fullName, password } = req.body;

    if([ username, email, fullName, password ].some((field) => {
        field?.trim() === ""
    })) {
        throw new ApiError(400, "All fields are required");
    }

    const userExists = await User.findOne({
        $or: [ { username }, { email } ]
    });
    if(userExists){
        throw new ApiError(400, "User already exists");
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;
    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file required");
    }
    const avatar = uploadOnCloudinary(avatarLocalPath);
    if(!coverImageLocalPath){
        const coverImage = uploadOnCloudinary(coverImageLocalPath);
    }

    const user = await User.create({
        username : username.toLowerCase(),
        email,
        fullName,
        avatar : avatar.url,
        coverImage : coverImage?.url || "",
        password
    });

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );
    if(!createdUser) {
        throw new ApiError(500, "User not created due to server error");
    }

    return res.status(201).json(
        new ApiRespnse(200, createdUser, "User sucessfully created")
    );
});

export { registerUser };