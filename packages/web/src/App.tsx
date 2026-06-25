import { useState } from "react";
import { EnrollScreen } from "@/components/enroll-screen";
import { Workspace } from "@/components/workspace";

const KEY_KEY = "super-talk:key";

// The bearer key is the identity. Source it from ?key=… in the URL (handy for the bootstrap owner
// key or opening a second window) or from localStorage.
function initialKey(): string | null {
  const fromUrl = new URLSearchParams(location.search).get("key")?.trim();
  return fromUrl || localStorage.getItem(KEY_KEY);
}

export function App(): React.JSX.Element {
  const [authKey, setAuthKey] = useState<string | null>(initialKey);

  const onEnrolled = (key: string) => {
    localStorage.setItem(KEY_KEY, key);
    setAuthKey(key);
  };
  const signOut = () => {
    localStorage.removeItem(KEY_KEY);
    setAuthKey(null);
  };

  return authKey ? (
    <Workspace authKey={authKey} onSignOut={signOut} />
  ) : (
    <EnrollScreen onEnrolled={onEnrolled} />
  );
}
