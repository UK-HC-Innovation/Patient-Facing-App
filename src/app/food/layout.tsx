import type { Metadata } from "next";
import type { ReactNode } from "react";

const description = "See a food's Food Compass score and explore better alternatives.";
const socialImage = "https://patient-centered.vercel.app/og.png";

export const metadata: Metadata = {
  title: "1 good choice",
  description,
  manifest: "/food-lens.webmanifest",
  icons: { icon: "/food-lens-icon.svg" },
  openGraph: {
    title: "1 good choice",
    description,
    type: "website",
    images: [
      {
        url: socialImage,
        width: 1200,
        height: 630,
        alt: "1 good choice — See it. Score it. Choose."
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "1 good choice",
    description,
    images: [socialImage]
  }
};

export default function FoodLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
