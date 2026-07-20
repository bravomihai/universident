import { AccountTypeSwitcher } from "@/components/auth/account-type-switcher";

export default function RegistrationLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="flex flex-1 items-start justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-md space-y-4">
        <AccountTypeSwitcher />
        {children}
      </div>
    </main>
  );
}