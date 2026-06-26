import { useAppContext } from "../../../context/appContextProvider";
import { API_POST_FORGOT_PASSWORD } from "@constants";
import React, { useEffect, useState } from "react";
import { Modal, Input, Button } from "@ds";
import { usePost } from "@utils";

export function ForgotPassword() {
  const { showToast } = useAppContext();
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [email, setEmail] = useState("");

  const post = usePost({
    url: API_POST_FORGOT_PASSWORD,
    callback: (data) => {
      if (!data) return;

      showToast({
        type: "success",
        message: data.message,
      });

      setShowForgotPasswordModal(false);
      setIsSending(false);
    },
  });

  function handleSend() {
    setIsSending(true);
    post.post({ email });
  }

  function handleEmailChange(e) {
    setEmail(e.target.value);
  }

  useEffect(() => {
    if (post.error) {
      showToast({
        type: "danger",
        message: post.error,
      });
    }
  }, [post.error]);

  return (
    <>
      <Modal title='Forgot Password' open={showForgotPasswordModal}>
        <p className='mb-4'>
          Please enter your email below and a temporary password will be sent to
          you.
        </p>
        <Input
          onChange={handleEmailChange}
          placeholder='Enter your email'
          className='w-full mb-4'
          type='email'
        />
        <Button
          primary
          onClick={handleSend}
          className='w-full'
          isLoading={isSending}
        >
          Send
        </Button>
      </Modal>
      <button
        className='bg-transparent p-0 m-0 text-dr-accent-light text-center w-full mt-1 cursor-pointer hover:underline'
        onClick={() => setShowForgotPasswordModal(true)}
      >
        Forgot password?
      </button>
    </>
  );
}
