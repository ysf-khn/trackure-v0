"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

export const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Prevent scrolling when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isMenuOpen]);

  return (
    <>
      <nav className="fixed top-0 z-50 w-full border-b border-gray-800 bg-black/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <div className="relative h-6 w-6 mr-2">
              <Image
                src="/logo.svg"
                alt="Trakure Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <span className="text-xl font-bold text-white">Trakure</span>
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
              href="/pricing"
              className="text-sm text-gray-300 hover:text-white"
            >
              Pricing
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
            <Button
              size="sm"
              className="text-white bg-blue-600 hover:bg-blue-700"
            >
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
      </nav>

      {/* Mobile menu with backdrop */}
      {isMenuOpen && (
        <>
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setIsMenuOpen(false)}
          />
          <div className="fixed inset-x-0 top-16 z-50 md:hidden">
            <div className="space-y-1 border-t border-gray-800 bg-black/90 px-4 pt-4 pb-6 backdrop-blur-md">
              <Link
                href="#features"
                className="block py-2 text-base text-gray-300 hover:text-white"
                onClick={() => setIsMenuOpen(false)}
              >
                Features
              </Link>
              <Link
                href="/pricing"
                className="block py-2 text-base text-gray-300 hover:text-white"
                onClick={() => setIsMenuOpen(false)}
              >
                Pricing
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
                  className="w-full text-white bg-blue-600 hover:bg-blue-700"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Start Free Trial
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};
