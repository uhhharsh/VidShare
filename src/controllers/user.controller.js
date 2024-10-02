import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const generateAccessAndRefreshToken = async (userId) => {

    try {
        const user = User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
        
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });
        return {accessToken, refreshToken};

    } catch (error) {
        throw new ApiError(500, "Something went wrong generating access and refresh token")
    }
};

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
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path;
    }
    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

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
        new ApiResponse(200, createdUser, "User sucessfully created")
    );
});

const loginUser = asyncHandler( async (req, res) => {
    // take input details from frontend (id/email + password)
    // validate input (correct format and required or not)
    // check if user exists already (by email and username)
    // password check if it matches the one stored in db
    // generate access and refresh tokens 
    // send cookie

    const { username, email, password } = req.body;

    if(!username && !email){
        throw new ApiError(400, "username or password is required");
    }

    const user = await User.findOne({
        $or: [ { username }, { email } ]
    });
    if(user){
        throw new ApiError(400, "User already exists");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);
    if(!isPasswordValid){
        throw new ApiError(401, "Invalid user credentials")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id);

    const loggedInUser = await User.findById(user._id)
    .select("-password -refreshToken");

    const options = {
        httpOnly : true,
        secure : true
    }
    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user : loggedInUser, accessToken, refreshToken
            },
            "User logged in successfully"
        )
    )

});

const logoutUser = asyncHandler( async (req, res) => {

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken : undefined
            } 
        },
        {
            new : true
        }
    )

    const options = {
        httpOnly : true,
        secure : true
    }
    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out"))
});

export { registerUser, loginUser, logoutUser };