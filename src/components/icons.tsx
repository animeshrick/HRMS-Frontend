// Line icons for the sidebar and buttons. They are decoration only: the text next to them carries the meaning.
import type { ReactNode } from "react";

function Icon({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      {children}
    </svg>
  );
}

export const HomeIcon = () => <Icon><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></Icon>;
export const ChatIcon = () => <Icon><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z" /></Icon>;
export const LeaveIcon = () => <Icon><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></Icon>;
export const ClockIcon = () => <Icon><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>;
export const TeamIcon = () => <Icon><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.7c2 .6 3.2 2.3 3.5 5.3" /></Icon>;
export const ApprovalIcon = () => <Icon><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></Icon>;
export const ShieldIcon = () => <Icon><path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4" /></Icon>;
export const UserIcon = () => <Icon><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6" /></Icon>;
export const KeyIcon = () => <Icon><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M16 7l3 3" /></Icon>;
// An ID card: the frame, the photo square and two lines of details. Used for the Govt ID step.
export const IdCardIcon = () => <Icon><rect x="2" y="5" width="20" height="14" rx="2" /><circle cx="8" cy="11" r="2" /><path d="M14 10h4M14 14h4M6 16h4" /></Icon>;
export const SunIcon = () => <Icon><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Icon>;
export const MoonIcon = () => <Icon><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" /></Icon>;
export const MenuIcon = () => <Icon size={20}><path d="M4 7h16M4 12h16M4 17h16" /></Icon>;
export const CloseIcon = () => <Icon size={20}><path d="M6 6l12 12M18 6L6 18" /></Icon>;
export const LogoutIcon = () => <Icon><path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" /><path d="M16 8l4 4-4 4M20 12H9" /></Icon>;
export const FolderIcon = () => <Icon><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></Icon>;
export const PayslipIcon = () => <Icon><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M8.5 8h7M8.5 11.5h7M8.5 15h4" /></Icon>;
export const WfhIcon = () => <Icon><path d="M4 11l8-6 8 6" /><path d="M6 10v10h12V10" /><rect x="9" y="13" width="6" height="4.5" rx="0.5" /><path d="M9 20.5h6" /></Icon>;

// The AI assistant's floating chat button - an original robot-head glyph (antenna, scanner eyes,
// side sensor tabs) so the button reads clearly as "AI bot" rather than a literal insect.
export const BotIcon = () => (
  <Icon size={26}>
    <rect x="5.5" y="7" width="13" height="11" rx="3" />
    <path d="M12 7V4.2" />
    <circle cx="12" cy="3.2" r="1" />
    <circle cx="9" cy="12" r="1.3" />
    <circle cx="15" cy="12" r="1.3" />
    <path d="M9 15.8h6" />
    <path d="M5.5 10.5H3.3M5.5 13.5H3.3M18.5 10.5h2.2M18.5 13.5h2.2" />
  </Icon>
);
