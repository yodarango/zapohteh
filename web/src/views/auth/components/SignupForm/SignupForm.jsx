import { useAppContext } from "../../../context/appContextProvider";
import { Input, Button, Modal, Thumbnail, IfElse, AvatarPicker } from "@ds";
import React, { useState, useEffect } from "react";
import { API_POST_SIGNUP } from "@constants";
import { usePost } from "@utils";
import { avatars } from "@images";

export const SignupForm = () => {
  const { showToast, setupAuth } = useAppContext();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    confirmPassword: "",
    first_name: "",
    last_name: "",
    username: "",
    password: "",
    email: "",
    avatar: "",
  });

  const [showAvatarModal, setShowAvatarModal] = useState(false);

  const { post, loading, error } = usePost({
    url: API_POST_SIGNUP,
    callback: (data) => {
      if (!data) return;

      localStorage.setItem("auth", data.AuthToken.replace("Bearer ", ""));

      setupAuth();

      showToast({
        message: "Account created successfully! Welcome to Goilerplate.",
        type: "success",
      });
    },
  });

  const handleInputChange = (field) => (e) => {
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const handleAvatarSave = (avatarPath) => {
    setFormData((prev) => ({
      ...prev,
      avatar: avatarPath,
    }));
    setShowAvatarModal(false);
  };

  const chosenAvater =
    avatars.find((avatar) => avatar.pathName === formData.avatar) || {};

  const validateForm = () => {
    if (!formData.first_name.trim()) {
      showToast({ type: "danger", message: "First name is required" });
      return false;
    }
    if (!formData.last_name.trim()) {
      showToast({ type: "danger", message: "Last name is required" });
      return false;
    }
    if (!formData.username.trim()) {
      showToast({ type: "danger", message: "Username is required" });
      return false;
    }
    if (!formData.email.trim()) {
      showToast({ type: "danger", message: "Email is required" });
      return false;
    }
    if (!formData.email.includes("@")) {
      showToast({
        type: "danger",
        message: "Please enter a valid email address",
      });
      return false;
    }
    if (!formData.password.trim()) {
      showToast({ type: "danger", message: "Password is required" });
      return false;
    }
    if (formData.password.length < 6) {
      showToast({
        type: "danger",
        message: "Password must be at least 6 characters long",
      });
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      showToast({ type: "danger", message: "Passwords do not match" });
      return false;
    }
    if (!formData.avatar.trim()) {
      showToast({ type: "danger", message: "Please select an avatar" });
      return false;
    }
    return true;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const { confirmPassword, ...signupData } = formData;
    post(signupData);
  };

  useEffect(() => {
    if (error) {
      showToast({
        type: "danger",
        message: error,
      });
    }
  }, [error]);

  return (
    <form onSubmit={handleSubmit} className='w-full'>
      <div>
        <div className='mb-4'>
          <label
            htmlFor='first_name'
            className='mb-1 block text-sm font-medium'
          >
            First Name
          </label>
          <Input
            onChange={handleInputChange("first_name")}
            value={formData.first_name}
            placeholder='First name'
            className='mb-4'
            id='first_name'
            type='text'
            required
          />
        </div>

        <div className='mb-4'>
          <label htmlFor='last_name' className='mb-1 block text-sm font-medium'>
            Last Name
          </label>
          <Input
            onChange={handleInputChange("last_name")}
            value={formData.last_name}
            placeholder='Last name'
            className='mb-4'
            id='last_name'
            type='text'
            required
          />
        </div>
      </div>

      <div className='mb-4'>
        <label htmlFor='username' className='mb-1 block text-sm font-medium'>
          Username
        </label>
        <Input
          onChange={handleInputChange("username")}
          placeholder='Choose a username'
          value={formData.username}
          className='mb-4'
          id='username'
          type='text'
          required
        />
      </div>

      <div className='mb-4'>
        <label htmlFor='email' className='mb-1 block text-sm font-medium'>
          Email
        </label>
        <Input
          onChange={handleInputChange("email")}
          placeholder='Enter your email'
          value={formData.email}
          className='mb-4'
          type='email'
          id='email'
          required
        />
      </div>

      <div className='mb-4'>
        <label htmlFor='password' className='mb-1 block text-sm font-medium'>
          Password
        </label>
        <div className='relative'>
          <Input
            onChange={handleInputChange("password")}
            placeholder='Create a password'
            value={formData.password}
            className='mb-4'
            type={showPassword ? "text" : "password"}
            id='password'
            required
          />
          <button
            type='button'
            className='absolute top-1/2 right-4 -translate-y-1/2 bg-transparent border-none cursor-pointer text-dr-text opacity-60 hover:opacity-100 z-10 p-1'
            onClick={() => setShowPassword(!showPassword)}
          >
            <ion-icon
              name={showPassword ? "eye-off-outline" : "eye-outline"}
            ></ion-icon>
          </button>
        </div>
      </div>

      <div className='mb-4'>
        <label
          htmlFor='confirmPassword'
          className='mb-1 block text-sm font-medium'
        >
          Confirm Password
        </label>
        <div className='relative'>
          <Input
            onChange={handleInputChange("confirmPassword")}
            placeholder='Confirm your password'
            value={formData.confirmPassword}
            id='confirmPassword'
            className='mb-4'
            type={showConfirmPassword ? "text" : "password"}
            required
          />
          <button
            type='button'
            className='absolute top-1/2 right-4 -translate-y-1/2 bg-transparent border-none cursor-pointer text-dr-text opacity-60 hover:opacity-100 z-10'
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            <ion-icon
              name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
            ></ion-icon>
          </button>
        </div>
      </div>

      <div className='flex flex-col items-center justify-center'>
        <IfElse condition={formData.avatar && chosenAvater.image}>
          <div className='bg-dr-surface-light/20 w-full p-4 rounded-lg mb-4 flex items-center justify-start gap-4'>
            <div
              className='h-44 w-44 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-dr-accent-light to-dr-accent hover:scale-[0.98] transition-transform duration-200 cursor-pointer'
              onClick={() => setShowAvatarModal(true)}
            >
              <Thumbnail
                alt={`Selected avatar: ${chosenAvater.name}`}
                src={chosenAvater.image}
                width='90%'
              />
            </div>
            <p className='text-3xl font-bold mb-0 opacity-60 text-center'>
              {chosenAvater.animal}
            </p>
          </div>
          <Button
            onClick={() => setShowAvatarModal(true)}
            className='w-full mb-4'
            type='button'
            primary
          >
            Select avatar
          </Button>
        </IfElse>
      </div>

      <Button type='submit' success isLoading={loading} className='w-full'>
        Create Account
      </Button>

      <Modal
        onClose={() => setShowAvatarModal(false)}
        title='Choose Your Avatar'
        open={showAvatarModal}
        showWaves={false}
      >
        <AvatarPicker onSave={handleAvatarSave} isLoading={loading} />
      </Modal>
    </form>
  );
};
