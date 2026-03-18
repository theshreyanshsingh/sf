"use client";

import React, { useState } from "react";
// import Image from "next/image";
import Link from "next/link";
import { FaEllipsisVertical } from "react-icons/fa6";
import { motion, AnimatePresence, Variants } from "framer-motion";

import { useAuthenticated } from "../helpers/useAuthenticated";
import { useRouter } from "next/navigation";
import { IoMenu } from "react-icons/io5";
import ProjectsSidebar from "./ProjectsSidebar";

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const router = useRouter();

  const { email, isAuthenticated } = useAuthenticated();

  const menuVariants = {
    hidden: { opacity: 0, y: -50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };

  const modalVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,

      transition: { duration: 0.3, ease: "easeOut" },
    },
    exit: {
      opacity: 0,

      transition: { duration: 0.2, ease: "easeIn" },
    },
  };

  const hoverEffect = {
    hover: {
      scale: 1.05,
      filter: "brightness(1.5) drop-shadow(0 0 8px rgba(255,255,255,0.6))",
      transition: { duration: 0.3 },
    },
  };

  const handleLogin = async () => {
    try {
      if (!isAuthenticated.value) {
        // dispatch(setLoginModalOpen(true));
        router.push("/login");
      } else {
        router.push("/settings");
      }
    } catch (error) {
      console.log("Error opening Login Modal", error);
    }
  };

  return (
    <>
      <motion.header
        initial="hidden"
        animate="visible"
        variants={menuVariants}
        className="fixed top-[52px] sm:top-[60px] left-0 right-0 backdrop-blur-sm z-10 "
      >
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <motion.div
              className="space-x-1 sm:space-x-2 flex justify-between items-center"
              whileHover="hover"
              variants={hoverEffect}
            >
              {/* 3Dot */}
              {isAuthenticated.value && (
                <div
                  className="text-white text-md cursor-pointer"
                  onClick={() => setSidebarOpen(true)}
                >
                  <IoMenu />
                </div>
              )}
              <Link href="/" className="flex items-center justify-center group">
                {/* <div className="relative w-7 h-7 transform group-hover:scale-105 transition-transform">
                  <Image
                    src="/logo.svg"
                    alt="Logo"
                    fill
                    className="object-contain"
                  />
                </div> */}
                <span className="ml-2.5 text-sm sm:text-lg font-[insSerifIt] font-semibold tracking-tight text-white">
                  Superblocks
                </span>
              </Link>
            </motion.div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center  justify-center  space-x-8">
              <motion.div whileHover="hover" variants={hoverEffect}>
                <a
                  href="#pricing"
                  className="text-xs font-medium text-gray-400 hover:text-white transition-colors cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault();
                    document
                      .getElementById("pricing")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  Pricing
                </a>
              </motion.div>
              <motion.div whileHover="hover" variants={hoverEffect}>
                <a
                  href="#faq"
                  className="text-xs font-medium text-gray-400 hover:text-white transition-colors cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault();
                    document
                      .getElementById("faq")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  FAQ
                </a>
              </motion.div>

              <motion.button
                onClick={handleLogin}
                whileHover="hover"
                variants={hoverEffect}
                className={`bg-white/90 cursor-pointer text-black text-xs font-medium ${email ? "px-2 p-1" : "px-4 py-1"} rounded-md`}
              >
                {email.value !== null &&
                email.value !== undefined &&
                typeof email.value === "string"
                  ? email.value.charAt(0).toUpperCase()
                  : "Get Started"}
              </motion.button>
            </div>

            {/* Mobile Navigation */}

            <div className="md:hidden flex items-center space-x-4">
              <motion.button
                onClick={handleLogin}
                className={`bg-white/90 text-black cursor-pointer text-xs font-medium ${email ? "px-2 p-1" : "px-4 py-1"} rounded-md`}
              >
                {email.value !== null &&
                email.value !== undefined &&
                typeof email.value === "string"
                  ? email.value.charAt(0).toUpperCase()
                  : "Get Started"}
              </motion.button>
              <button onClick={() => setMenuOpen(true)}>
                <FaEllipsisVertical className="text-white w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Fullscreen Mobile Menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalVariants}
            className="fixed inset-0 bg-[#0A0A0D]/80 backdrop-blur-lg flex flex-col justify-center items-center text-white z-50"
          >
            <button
              onClick={() => setMenuOpen(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors text-sm"
            >
              ✕
            </button>

            <nav className="text-center space-y-6 text-lg">
              <a
                href="#pricing"
                className="block text-gray-300 hover:text-white transition-colors font-sans font-medium text-sm cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  setMenuOpen(false);
                  document
                    .getElementById("pricing")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Pricing
              </a>
            </nav>
            <nav className="text-center space-y-6 text-lg">
              <a
                href="#faq"
                className="block text-gray-300 hover:text-white transition-colors font-sans font-medium text-sm cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  setMenuOpen(false);
                  document
                    .getElementById("faq")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                FAQ
              </a>
            </nav>
            <nav className="text-center space-y-6 text-lg">
              <Link
                href="/contact"
                className="block text-gray-300 hover:text-white transition-colors font-sans font-medium text-sm"
                onClick={() => setMenuOpen(false)}
              >
                Contact
              </Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Projects Sidebar */}
      <ProjectsSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
    </>
  );
};

export default Header;
