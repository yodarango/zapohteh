import { useAppContext } from "../../../context/appContextProvider";
import { ForgotPassword } from "../ForogotPassword/ForogotPassword";
import React, { useState, useEffect } from "react";
import { API_POST_LOGIN } from "@constants";
import { Input, Button, Modal } from "@ds";
import { usePost } from "@utils";

export const LoginForm = () => {
  const { showToast, setupAuth } = useAppContext();

  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  const { post, loading, error } = usePost({
    url: API_POST_LOGIN,
    callback: (data) => {
      if (!data) return;

      localStorage.setItem("auth", data.AuthToken.replace("Bearer ", ""));

      setupAuth();

      showToast({
        type: "success",
        message: "Login successful! Welcome back.",
      });
    },
  });

  const handleInputChange = (field) => (e) => {
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Basic validation
    if (!formData.username.trim() || !formData.password.trim()) {
      showToast({
        type: "danger",
        message: "Please fill in all fields",
      });
      return;
    }

    post(formData);
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
      <div className='mb-4'>
        <label htmlFor='username' className='mb-1 block text-sm font-medium'>
          Username
        </label>
        <Input
          placeholder='Enter your username'
          onChange={handleInputChange("username")}
          className='mb-4'
          value={formData.username}
          id='username'
          type='text'
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
            placeholder='Enter your password'
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

      <Button type='submit' primary isLoading={loading} className='w-full mb-1'>
        Sign In
      </Button>
      <ForgotPassword />
    </form>
  );
};
