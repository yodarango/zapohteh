import { Button, Modal, Thumbnail } from "@ds";
import { useEffect, useState } from "react";
import { avatars } from "@images";

export const AvatarPicker = (props) => {
  const { onSave, isLoading, onSuccess, withConfirmation } = props;

  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [currentAvatar, setCurrentAvatar] = useState("");

  const handleSave = () => {
    onSave(currentAvatar);
  };

  const handleAvatarClick = (animal) => {
    setShowConfirmationModal(true);
    setCurrentAvatar(animal);
  };

  useEffect(() => {
    if (onSuccess) {
      setShowConfirmationModal(false);
    }
  }, [onSuccess]);

  return (
    <>
      <Modal
        title='You are about to change your avatar, Please confirm'
        onClose={() => setShowConfirmationModal(false)}
        open={showConfirmationModal}
        showWaves={false}
        zIndex={17}
      >
        <div className='flex items-center justify-center w-full gap-4 mt-4'>
          <Button
            onClick={() => setShowConfirmationModal(false)}
            className='w-1/2'
            secondary
          >
            Cancel
          </Button>
          <Button
            loading={isLoading}
            onClick={handleSave}
            className='w-1/2'
            primary
          >
            Save
          </Button>
        </div>
      </Modal>
      <div className='flex items-start justify-center flex-wrap gap-4 pb-6'>
        {avatars.map((avatar) => (
          <div
            className='inline-flex items-center justify-center flex-shrink-0 p-4 h-52 w-52 rounded-full overflow-hidden bg-gradient-to-br from-dr-accent-light to-dr-accent'
            key={avatar.id}
          >
            <div
              className='inline-flex items-center justify-center flex-shrink-0 bg-dr-surface rounded-full h-48 w-48 hover:scale-[0.98] transition-transform duration-200 cursor-pointer'
              onClick={() => {
                if (withConfirmation) handleAvatarClick(avatar.pathName);
                else onSave(avatar.pathName);
              }}
            >
              <Thumbnail
                alt="avatar for user's profile"
                className='rounded-full h-full w-full object-cover'
                src={avatar.image}
                width={"100%"}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
};
