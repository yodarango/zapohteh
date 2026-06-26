import { useAppContext } from "../../../context/appContextProvider";
import { API_GET_VERIFY_EMAIL, ROUTE_HOME } from "@constants";
import React, { useState, useEffect, useRef } from "react";
import ThankyouImage from "@images/statuses/thank_you.webp";
import { Button, Thumbnail, IfElse } from "@ds";
import { Link } from "react-router-dom";
import { usePost } from "@utils";

export const Layout = () => {
  const { showToast, setupAuth } = useAppContext();
  const inputRefs = useRef([]);

  const [verificationCode, setVerificationCode] = useState([
    "",
    "",
    "",
    "",
    "",
    "",
  ]);

  const { post, loading, success, error } = usePost({
    url: API_GET_VERIFY_EMAIL,
    callback: (responseData) => {
      if (responseData) {
        localStorage.setItem(
          "auth",
          responseData.AuthToken.replace("Bearer ", ""),
        );

        setupAuth();

        showToast({
          type: "success",
          message: "Email verified successfully! Welcome to Goilerplate!",
        });
      }
    },
  });

  const handleInputChange = (index, value) => {
    if (value.length > 1) return;

    const newCode = [...verificationCode];
    newCode[index] = value.toUpperCase();
    setVerificationCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !verificationCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();

    // Check if pasted data is exactly 6 characters (alphanumeric)
    if (pastedData.length === 6 && /^[A-Za-z0-9]{6}$/.test(pastedData)) {
      const newCode = pastedData.toUpperCase().split("");
      setVerificationCode(newCode);

      // Focus the last input
      inputRefs.current[5]?.focus();
    } else {
      showToast({
        type: "danger",
        message: "Please paste a valid 6-digit verification code",
      });
    }
  };

  const handleVerify = () => {
    const code = verificationCode.join("");

    if (code.length !== 6) {
      showToast({
        type: "danger",
        message: "Please enter the complete 6-digit verification code.",
      });
      return;
    }

    post({ code });
  };

  function handlePasteCode() {
    navigator.clipboard.readText().then((text) => {
      if (text.length === 6) {
        setVerificationCode(text.split(""));
      } else {
        showToast({
          type: "danger",
          message: "Invalid verification code",
        });
      }
    });
  }

  useEffect(() => {
    if (error) {
      showToast({
        type: "danger",
        message: error,
      });
    }
  }, [error]);

  if (success) {
    return (
      <div className='flex min-h-[calc(100vh-10rem)] items-start justify-center px-4 py-8'>
        <div className='bg-dr-surface p-5 rounded-2xl'>
          <div className='flex items-center justify-center gap-3 mb-4'>
            <ion-icon
              name='checkmark-circle'
              className='text-dr-success text-2xl'
            ></ion-icon>
            <h3 className='m-0 text-xl font-bold'>
              Your email has been verified
            </h3>
          </div>
          <p className='mb-4 text-center'>
            Welcome to Goilerplate! Your account is ready to use.
          </p>
          {/* welcoming thumbnail */}
          <Thumbnail
            className='mb-4 mx-auto block'
            alt='Welcome to Goilerplate'
            src={ThankyouImage}
            maxWidth='40rem'
            width='100%'
          />
          <div>
            <Link to={ROUTE_HOME}>
              <Button success className='w-full'>
                Go Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='flex min-h-[calc(100vh-10rem)] items-start justify-center px-4 py-8'>
      <div className='bg-dr-surface p-5 rounded-2xl'>
        <div className='flex items-center justify-center gap-3 mb-4'>
          <ion-icon name='mail-outline' className='text-2xl'></ion-icon>
          <h3 className='m-0 text-xl font-bold'>Verify Your Email</h3>
        </div>
        <p className='mb-4 text-center'>
          Enter the 6-digit verification code sent to your email address.
        </p>

        <div className='flex items-center justify-center gap-2 w-full mb-4'>
          {verificationCode.map((digit, index) => (
            <input
              className='w-20 flex-1 bg-dr-bg border py-4 px-2 rounded-lg text-center text-2xl font-extrabold text-dr-text outline-none'
              onChange={(e) => handleInputChange(index, e.target.value)}
              ref={(el) => (inputRefs.current[index] = el)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              value={digit}
              maxLength={1}
              key={index}
              type='text'
            />
          ))}
        </div>

        <IfElse condition={verificationCode.join("").length === 6}>
          <div>
            <Button
              disabled={verificationCode.join("").length !== 6}
              onClick={handleVerify}
              isLoading={loading}
              className='w-full'
              primary
            >
              Verify Email
            </Button>
          </div>
          <div>
            <Button onClick={handlePasteCode} className='w-full' secondary>
              Paste Code
            </Button>
          </div>
        </IfElse>
      </div>
    </div>
  );
};
