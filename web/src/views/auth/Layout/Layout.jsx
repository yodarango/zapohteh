import { SignupForm } from "../components/SignupForm/SignupForm";
import { LoginForm } from "../components/LoginForm/LoginForm";
import React, { useState } from "react";
import { Button, IfElse } from "@ds";

export const Layout = () => {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className='flex min-h-[calc(100vh-10rem)] items-start justify-center px-4 py-8'>
      <div className='w-full max-w-[60rem] rounded-2xl bg-dr-surface p-4'>
        <h3 className='text-center mb-4 text-2xl font-bold'>
          {isLogin ? "Welcome Back" : "Create Account"}
        </h3>

        <div className='mb-4'>
          <IfElse condition={isLogin}>
            <LoginForm />
            <SignupForm />
          </IfElse>
        </div>

        <div>
          <Button
            secondary
            onClick={() => setIsLogin(!isLogin)}
            className='w-full'
          >
            {isLogin ? "Sign Up Instead" : "Sign In Instead"}
          </Button>
        </div>
      </div>
    </div>
  );
};
