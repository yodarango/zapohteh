import { useState } from "react";
import { Button, Input, Modal, Thumbnail } from "@ds";
import { AvatarPicker } from "@ds";
import { avatars } from "@images";
import {
  API_POST_UPDATE_PROFILE,
  API_POST_CHANGE_PASSWORD,
} from "@constants";
import { useAppContext } from "@views/context/appContextProvider";

export const MeView = () => {
  const { state, showToast, setupAuth } = useAppContext();
  const user = state?.user || {};

  const [firstName, setFirstName] = useState(user.first_name || "");
  const [lastName, setLastName] = useState(user.last_name || "");
  const [username, setUsername] = useState(user.username || "");
  const [email, setEmail] = useState(user.email || "");
  const [avatar, setAvatar] = useState(user.avatar || "");
  const [saving, setSaving] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const chosenAvatar = avatars.find((a) => a.pathName === avatar) || {};
  const displayName =
    [firstName, lastName].filter(Boolean).join(" ") || user.first_name || "User";

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!username.trim() || !email.trim()) {
      showToast({ type: "danger", message: "Username and email are required" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(API_POST_UPDATE_PROFILE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("auth"),
        },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          username: username.trim(),
          email: email.trim(),
          avatar: avatar.trim(),
        }),
      });
      const result = await res.json();
      if (result.error || !result.success) {
        showToast({
          type: "danger",
          message: String(result.error || "Failed to update profile"),
        });
      } else {
        if (result.data?.AuthToken) {
          localStorage.setItem(
            "auth",
            result.data.AuthToken.replace("Bearer ", ""),
          );
          setupAuth();
        }
        showToast({ type: "success", message: "Profile updated" });
      }
    } catch (err) {
      showToast({ type: "danger", message: err.message || "Update failed" });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!newPassword.trim() || newPassword.length < 6) {
      showToast({
        type: "danger",
        message: "Password must be at least 6 characters",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast({ type: "danger", message: "Passwords do not match" });
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch(API_POST_CHANGE_PASSWORD, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("auth"),
        },
        body: JSON.stringify({ new_password: newPassword }),
      });
      const result = await res.json();
      if (result.error || !result.success) {
        showToast({
          type: "danger",
          message: String(result.error || "Failed to change password"),
        });
      } else {
        showToast({ type: "success", message: "Password changed" });
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      showToast({
        type: "danger",
        message: err.message || "Password change failed",
      });
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <section>
      <h1 className='mb-1 text-2xl font-bold text-dr-text'>My Profile</h1>
      <p className='mb-6 text-sm text-dr-text-muted'>Manage your account.</p>

      <div className='mb-6 flex items-center gap-4'>
        <div className='flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-dr-accent-light text-2xl font-bold text-dr-accent'>
          {chosenAvatar.image ? (
            <Thumbnail
              src={chosenAvatar.image}
              alt={displayName}
              className='h-full w-full rounded-full object-cover'
            />
          ) : (
            displayName.charAt(0).toUpperCase()
          )}
        </div>
        <Button secondary onClick={() => setShowAvatarModal(true)}>
          Change avatar
        </Button>
      </div>

      <form
        onSubmit={handleSaveProfile}
        className='mb-8 rounded-2xl border border-dr-border bg-dr-surface p-4'
      >
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <div>
            <label className='mb-1 block text-sm font-medium text-dr-text'>
              First name
            </label>
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div>
            <label className='mb-1 block text-sm font-medium text-dr-text'>
              Last name
            </label>
            <Input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <div>
            <label className='mb-1 block text-sm font-medium text-dr-text'>
              Username
            </label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className='mb-1 block text-sm font-medium text-dr-text'>
              Email
            </label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <div className='mt-4 flex justify-end'>
          <Button primary isLoading={saving}>
            Save profile
          </Button>
        </div>
      </form>

      <form
        onSubmit={handleChangePassword}
        className='rounded-2xl border border-dr-border bg-dr-surface p-4'
      >
        <h2 className='mb-4 text-lg font-semibold text-dr-text'>Password</h2>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <div>
            <label className='mb-1 block text-sm font-medium text-dr-text'>
              New password
            </label>
            <Input
              type='password'
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <label className='mb-1 block text-sm font-medium text-dr-text'>
              Confirm password
            </label>
            <Input
              type='password'
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>
        <div className='mt-4 flex justify-end'>
          <Button primary isLoading={changingPassword}>
            Change password
          </Button>
        </div>
      </form>

      <Modal
        title='Choose an avatar'
        open={showAvatarModal}
        onClose={() => setShowAvatarModal(false)}
        showWaves={false}
      >
        <AvatarPicker
          onSave={(path) => {
            setAvatar(path);
            setShowAvatarModal(false);
          }}
        />
      </Modal>
    </section>
  );
};
