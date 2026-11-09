"use client";

import { useActionState } from "react";
import { initialAuthState, updatePasswordAction } from "../actions";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePasswordAction, initialAuthState);

  return (
    <div className="account-login-card">
      <form className="account-form" action={action}>
        <label className="account-field">
          <span>Parolă nouă</span>
          <input type="password" name="password" minLength={8} required autoComplete="new-password" />
        </label>
        <label className="account-field">
          <span>Confirmă parola</span>
          <input type="password" name="passwordConfirmation" minLength={8} required autoComplete="new-password" />
        </label>
        <button className="account-login-button" type="submit" disabled={pending}>
          {pending ? "Se salvează…" : "Salvează parola"}
        </button>
        {state.message ? <p className={`account-form-message ${state.status}`}>{state.message}</p> : null}
      </form>
    </div>
  );
}
