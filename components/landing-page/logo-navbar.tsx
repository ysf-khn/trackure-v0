"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

export const LogoOnlyNavbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-gray-800 bg-black/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <div className="relative h-10 w-10">
            <Image
              src="/logo-grey-bg.svg"
              alt="Trakure Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex md:items-center md:space-x-8">
          <Link
            href="#features"
            className="text-sm text-gray-300 hover:text-white"
          >
            Features
          </Link>
          <Link
            href="#pricing"
            className="text-sm text-gray-300 hover:text-white"
          >
            Pricing
          </Link>
          <Link
            href="#about"
            className="text-sm text-gray-300 hover:text-white"
          >
            About
          </Link>
          <Link href="/blog" className="text-sm text-gray-300 hover:text-white">
            Blog
          </Link>
        </div>

        {/* Desktop CTA and sign in */}
        <div className="hidden md:flex md:items-center md:space-x-4">
          <Link
            href="/sign-in"
            className="text-sm font-medium text-gray-300 hover:text-white"
          >
            Sign in
          </Link>
          <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
            Start Free Trial
          </Button>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMenuOpen ? (
            <X className="h-6 w-6 text-white" />
          ) : (
            <Menu className="h-6 w-6 text-white" />
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden">
          <div className="space-y-1 border-t border-gray-800 bg-black/90 px-4 pt-4 pb-6 backdrop-blur-md">
            <Link
              href="#features"
              className="block py-2 text-base text-gray-300 hover:text-white"
              onClick={() => setIsMenuOpen(false)}
            >
              Features
            </Link>
            <Link
              href="#pricing"
              className="block py-2 text-base text-gray-300 hover:text-white"
              onClick={() => setIsMenuOpen(false)}
            >
              Pricing
            </Link>
            <Link
              href="#about"
              className="block py-2 text-base text-gray-300 hover:text-white"
              onClick={() => setIsMenuOpen(false)}
            >
              About
            </Link>
            <Link
              href="/blog"
              className="block py-2 text-base text-gray-300 hover:text-white"
              onClick={() => setIsMenuOpen(false)}
            >
              Blog
            </Link>
            <div className="mt-4 flex flex-col space-y-3 pt-3 border-t border-gray-800">
              <Link
                href="/sign-in"
                className="block text-center text-base font-medium text-gray-300 hover:text-white"
                onClick={() => setIsMenuOpen(false)}
              >
                Sign in
              </Link>
              <Button
                size="default"
                className="w-full bg-purple-600 hover:bg-purple-700"
                onClick={() => setIsMenuOpen(false)}
              >
                Start Free Trial
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};
