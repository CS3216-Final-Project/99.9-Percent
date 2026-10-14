import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { AVATARS, avatarName, avatarPicture, type AvatarId } from "@/game/avatars";
import { useGame } from "@/game/store";
import { Icon } from "./icons";
import { Modal } from "./ui";
import "./AvatarPicker.css";

/**
 * The avatars to choose from, as pictures in a grid of radio buttons. A choice applies at once, mid-game too, and
 * is remembered in this browser.
 */
function AvatarChoices() {
  const avatar = useGame((s) => s.avatar);
  const setAvatar = useGame((s) => s.setAvatar);
  const group = useId();
  return (
    <div className="avatar-options" role="radiogroup" aria-label="Avatar">
      {AVATARS.map((a) => (
        <label key={a.id} className={`avatar-option${avatar === a.id ? " is-on" : ""}`}>
          <input type="radio" name={group} value={a.id} checked={avatar === a.id} onChange={() => setAvatar(a.id as AvatarId)} />
          <img src={avatarPicture(a.id)} alt="" width={64} height={64} loading="lazy" decoding="async" />
          <span>{a.name}</span>
        </label>
      ))}
    </div>
  );
}

/** The menu's Avatar section, the same in every mode. */
export function AvatarSettings() {
  return (
    <section className="menu-section menu-avatar" aria-label="Avatar">
      <h4>
        <Icon name="user" size={20} />
        Your avatar
      </h4>
      <p className="menu-note">Walk the building as this animal: press Walk beside the room's camera buttons. Change it whenever you like.</p>
      <AvatarChoices />
    </section>
  );
}

/** The home screen's avatar chip, beside the account's, opening the choices. */
export function AvatarButton() {
  const avatar = useGame((s) => s.avatar);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="account-chip avatar-chip" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <img className="avatar-chip-picture" src={avatarPicture(avatar)} alt="" width={36} height={36} />
        <span className="account-chip-text">
          <span className="account-chip-name">{avatarName(avatar)}</span>
          <span className="account-chip-sub">Your avatar</span>
        </span>
      </button>
      {open &&
        createPortal(
          <Modal title="Your avatar" icon={{ kind: "users", name: "user" }} onClose={() => setOpen(false)} className="modal-avatar">
            <p className="menu-note">Walk the building as this animal. Change it whenever you like, from here or the menu.</p>
            <AvatarChoices />
            <div className="modal-foot">
              <span />
              <button type="button" className="btn btn-primary" onClick={() => setOpen(false)}>
                Done
              </button>
            </div>
          </Modal>,
          document.body,
        )}
    </>
  );
}
