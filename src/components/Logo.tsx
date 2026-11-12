// The company logo, shown exactly as supplied (public/logo.png). Replace that file with a larger copy for a sharper mark.
export function Logo({ size = 36 }: { size?: number }) {
  return <img src="/logo.png" alt="" width={size} height={size} className="shrink-0 select-none" draggable={false} />;
}
