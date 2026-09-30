import Link from "next/link";
import BrandMark from "@/components/BrandMark";

export default function SalesTopbar() {
  return (
    <header className="topbar sales-topbar">
      <BrandMark href="/" />
      <Link className="ghost" href="/login">
        Log in
      </Link>
    </header>
  );
}
