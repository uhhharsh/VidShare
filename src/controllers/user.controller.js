import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const generateAccessAndRefreshToken = async (userId) => {

    try {
        const user = await User.findById(userId);
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
    console.log(user.email);
    if(!user){
        throw new ApiError(400, "User doesn't exists");
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

const refreshingAccessToken = asyncHandler( async (req, res) => {

    // get refresh token
    const incomingRefreshToken = req.cookies?.refreshToken || req.body.refreshToken;
    if(!incomingRefreshToken){
        throw new ApiError(401, "No refresh token found");
    }
    console.log(incomingRefreshToken);
    try {
        // verify the refresh token
        const decodedRefreshToken = await jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
        if(!decodedRefreshToken){
            throw new ApiError(400, "token not getting decoded");
        }
        console.log(decodedRefreshToken);

        // find user by the id stored in refresh token
        const user = await User.findById(decodedRefreshToken._id);
        if(!user){
            throw new ApiError(401, "user not found specified in refresh token");
        }
    
        // match the refresh token of user and the retrieved refresh token
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(400, "refresh token doesn't match, either used or expired");
        }
    
        // generate new access and refresh token
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshToken(user._id);
    
        // options for cookies
        const options = {
            httpOnly : true,
            secure : true
        }
    
        // send response
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken : newRefreshToken},
                "access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(400, "error refreshing access token");
    }
});

const changeUserPassword = asyncHandler( async (req, res) => {
    
    const { oldPassword, newPassword } = req.body;

    if(!oldPassword || !newPassword){
        throw new ApiError(400, "old password and new password are required");
    }

    const user = await User.findById(req.user?._id);
    if(!user){
        throw new ApiError(400, "user not found");
    }

    const isPasswordValid = await user.isPasswordCorrect(oldPassword);
    if(!isPasswordValid){
        throw new ApiError(400, "old password doesn't match");
    }

    user.password = newPassword;
    await user.save({validateBeforeSave : false});
    
    return res
    .status(200)
    .json(new ApiResponse(200, {}, "password changed successfully"));
});

const getCurrentUser = asyncHandler( async (req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(200, req?.user, "user fetched successfully"))
});

const updateAccountDetails = asyncHandler( async (req, res) => {

    const {fullName, email} = req.body;

    if(!fullName || !email){
        throw new ApiError(400, "fullName and email are required");
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set : {
                fullName,
                email
            }
        },
        {
            new : true
        }
    ).select("-password -refreshToken");

    return res
    .status(200)
    .json(new ApiResponse(200, user, "account details updated successfully"));
});

const updateAvatar = asyncHandler( async (req, res) => {

    const {avatarLocalPath} = req.file?.path;

    if(!avatarLocalPath){
        throw new ApiError(400, "avatar is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if(!avatar?.url){
        throw new ApiError(500, "unable to upload avatar on cloudinary");
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set : {
                avatar : avatar?.url
            }
        },
        {
            new : true
        }
    ).select("-password -refreshToken");

    return res
    .status(200)
    .json(new ApiResponse(200, user, "avatar updated successfully"));
});

const updateCoverImage = asyncHandler( async (req, res) => {

    const {coverImageLocalPath} = req.file?.path;

    if(!coverImageLocalPath){
        throw new ApiError(400, "cover image is required");
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if(!coverImage?.url){
        throw new ApiError(500, "unable to upload cover image on cloudinary");
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set : {
                coverImage : coverImage?.url
            }
        },
        {
            new : true
        }
    ).select("-password -refreshToken");

    return res
    .status(200)
    .json(new ApiResponse(200, user, "cover image updated successfully"));
});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshingAccessToken,
    changeUserPassword,
    getCurrentUser,
    updateAccountDetails,
    updateAvatar,
    updateCoverImage
};