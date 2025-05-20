import Link from "next/link";
import { Twitter, Linkedin, Github, Mail } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full py-16 bg-black text-gray-300">
      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-16">
        <div className="grid grid-cols-1 md:grid-cols-3  gap-12 mb-12">
          {/* Company Info */}
          <div className="space-y-4">
            <h3 className="text-white font-semibold text-lg">Trackure</h3>
            <p className="text-sm text-gray-400">
              Streamline your inventory management and workflow processes with
              our powerful platform.
            </p>
            {/* <div className="flex space-x-4 pt-2">
              <a
                href="https://twitter.com/trackure"
                className="hover:text-white transition-colors"
              >
                <Twitter size={20} />
              </a>
              <a
                href="https://linkedin.com/company/trackure"
                className="hover:text-white transition-colors"
              >
                <Linkedin size={20} />
              </a>
              <a
                href="https://github.com/trackure"
                className="hover:text-white transition-colors"
              >
                <Github size={20} />
              </a>
            </div> */}
          </div>

          {/* Product */}
          <div className="space-y-4">
            <h3 className="text-white font-semibold text-lg">Product</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="#"
                  className="text-sm hover:text-white transition-colors"
                >
                  Features
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="text-sm hover:text-white transition-colors"
                >
                  Pricing
                </Link>
              </li>
              {/* <li>
                <Link
                  href="/integrations"
                  className="text-sm hover:text-white transition-colors"
                >
                  Integrations
                </Link>
              </li> */}
              <li>
                <Link
                  href="#"
                  className="text-sm hover:text-white transition-colors"
                >
                  Changelog
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          {/* <div className="space-y-4">
            <h3 className="text-white font-semibold text-lg">Resources</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/documentation"
                  className="text-sm hover:text-white transition-colors"
                >
                  Documentation
                </Link>
              </li>
              <li>
                <Link
                  href="/blog"
                  className="text-sm hover:text-white transition-colors"
                >
                  Blog
                </Link>
              </li>
              <li>
                <Link
                  href="/help"
                  className="text-sm hover:text-white transition-colors"
                >
                  Help Center
                </Link>
              </li>
              <li>
                <Link
                  href="/api"
                  className="text-sm hover:text-white transition-colors"
                >
                  API Reference
                </Link>
              </li>
            </ul>
          </div> */}

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="text-white font-semibold text-lg">Contact</h3>
            <div className="space-y-2">
              <a
                href="mailto:support@trackure.com"
                className="flex items-center text-sm hover:text-white transition-colors"
              >
                <Mail size={16} className="mr-2" />
                support@trackure.com
              </a>
              {/* <p className="text-sm text-gray-400">
                123 Business Street
                <br />
                Suite 100
                <br />
                New York, NY 10001
              </p> */}
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="pt-8 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-sm text-gray-400">
              © {currentYear} Trackure. All rights reserved.
            </div>
            <div className="flex space-x-6">
              <Link
                href="/privacy-policy"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms-of-service"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Terms of Service
              </Link>
              <Link
                href="#"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
