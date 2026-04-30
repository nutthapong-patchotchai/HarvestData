import "./globals.css";

export const metadata = {
  title: "HarvestData",
  description: "Fruit harvest management dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
