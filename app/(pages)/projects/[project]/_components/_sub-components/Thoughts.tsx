"use client";
import { setReaderMode } from "@/app/redux/reducers/projectOptions";
import { AppDispatch, RootState } from "@/app/redux/store";
import React, { useEffect, useState } from "react";
import { CiViewTimeline } from "react-icons/ci";
import { GoCodeOfConduct } from "react-icons/go";
import { LuBrain, LuLoaderCircle } from "react-icons/lu";
import { MdOutlineUpload } from "react-icons/md";
import { SiModal } from "react-icons/si";
import { TiFlashOutline, TiPen } from "react-icons/ti";
import { useDispatch, useSelector } from "react-redux";
import StreamedDataDisplay from "./Streams/StreamDataDisplay";
import { AnimatePresence, motion, Variants } from "framer-motion";
import { IoIosArrowForward } from "react-icons/io";

const items = [
  {
    text: "Analyzing your project requirements",
    icon: (
      <div className="w-6 h-6 bg-gradient-to-br from-[#4a90e2] to-[#5ba0f2] rounded-full flex items-center justify-center">
        <svg
          className="w-3 h-3 text-white"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    ),
  },
  {
    text: "Generating intelligent code solutions",
    icon: (
      <div className="w-6 h-6 bg-gradient-to-br from-[#4a90e2] to-[#5ba0f2] rounded-full flex items-center justify-center">
        <svg
          className="w-3 h-3 text-white"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    ),
  },
  {
    text: "Building responsive UI components",
    icon: (
      <div className="w-6 h-6 bg-gradient-to-br from-[#4a90e2] to-[#5ba0f2] rounded-full flex items-center justify-center">
        <svg
          className="w-3 h-3 text-white"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    ),
  },
  {
    text: "Implementing modern design patterns",
    icon: (
      <div className="w-6 h-6 bg-gradient-to-br from-[#4a90e2] to-[#5ba0f2] rounded-full flex items-center justify-center">
        <svg
          className="w-3 h-3 text-white"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    ),
  },
  {
    text: "Optimizing performance and accessibility",
    icon: (
      <div className="w-6 h-6 bg-gradient-to-br from-[#4a90e2] to-[#5ba0f2] rounded-full flex items-center justify-center">
        <svg
          className="w-3 h-3 text-white"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    ),
  },
  {
    text: "Setting up routing and navigation",
    icon: (
      <div className="w-6 h-6 bg-gradient-to-br from-[#4a90e2] to-[#5ba0f2] rounded-full flex items-center justify-center">
        <svg
          className="w-3 h-3 text-white"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    ),
  },
  {
    text: "Preparing your live application",
    icon: (
      <div className="w-6 h-6 bg-gradient-to-br from-[#4a90e2] to-[#5ba0f2] rounded-full flex items-center justify-center">
        <svg
          className="w-3 h-3 text-white"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    ),
  },
];

const containerVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: 20,
  },
  visible: (i = 1) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.25, 0.46, 0.45, 0.94], // Custom easing curve
      staggerChildren: 0.1, // Increased stagger delay
      delayChildren: 0.2 * i,
    },
  }),
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -20,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  },
};

const iconVariants: Variants = {
  hidden: {
    scale: 0.3,
    opacity: 0,
    y: 20,
    rotate: -180,
  },
  visible: {
    scale: 1,
    opacity: 1,
    y: 0,
    rotate: 0,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 20,
      duration: 0.8,
    },
  },
  exit: {
    scale: 0.3,
    opacity: 0,
    y: -20,
    rotate: 180,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

const textContainerVariants = {
  hidden: {
    opacity: 0,
    x: -20,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.5,
      staggerChildren: 0.08, // Increased stagger delay between words
      delayChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: {
      duration: 0.3,
      staggerChildren: 0.04,
      staggerDirection: -1,
    },
  },
};

// Variants for each word
const wordVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.8,
    rotateX: -90,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    rotateX: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 15,
      duration: 0.6,
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    scale: 0.8,
    rotateX: 90,
    transition: {
      duration: 0.2,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

const Thoughts = () => {
  const [index, setIndex] = useState(0);
  const dispatch = useDispatch<AppDispatch>();

  const handleRead = () => {
    dispatch(setReaderMode(true));
  };

  const { generating, readerMode } = useSelector(
    (state: RootState) => state.projectOptions
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prevIndex) => (prevIndex + 1) % items.length);
    }, 2500); // Change item every 2.5 seconds

    return () => clearInterval(interval);
  }, []);
  const currentItem = items[index];
  const words = currentItem.text.split(" ");

  return (
    <div className="flex-grow w-full h-full overflow-hidden relative px-3">
      {generating && readerMode ? (
        <StreamedDataDisplay />
      ) : (
        <div className="flex flex-col items-center justify-center h-full w-full">
          {/* Main Header Section */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              duration: 0.8,
              ease: [0.25, 0.46, 0.45, 0.94],
              delay: 0.2,
            }}
            className="text-center mb-8"
          >
            <motion.div
              className="flex items-center justify-center gap-3 mb-4"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <motion.div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 20,
                  delay: 0.6,
                }}
                whileHover={{ scale: 1.1, rotate: 5 }}
              >
                <LuLoaderCircle className="text-xl text-white animate-spin" />
              </motion.div>
              <motion.div
                className="text-left"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
              >
                <motion.h3
                  className="text-sm sm:text-xl font-semibold text-white font-sans"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 1.0 }}
                >
                  Building Your App
                </motion.h3>
                <motion.p
                  className="text-xs sm:text-xl text-[#b1b1b1] font-sans"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 1.2 }}
                >
                  Our Agent is working on your project, it may take a while...
                </motion.p>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Rotating Items Display - Card Design */}
          <motion.div
            className="w-full max-w-lg mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.4 }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                className="bg-[#141415] border border-[#2a2a2b] rounded-xl p-4 backdrop-blur-sm shadow-lg hover:shadow-xl transition-shadow duration-300"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                whileHover={{
                  scale: 1.02,
                  y: -2,
                  transition: { duration: 0.2 },
                }}
                layout
              >
                <div className="flex items-center gap-3">
                  {/* Animated Icon */}
                  <motion.span
                    variants={iconVariants}
                    whileHover={{
                      scale: 1.2,
                      rotate: 10,
                      transition: { duration: 0.2 },
                    }}
                  >
                    {currentItem.icon}
                  </motion.span>

                  {/* Animated Text (Word by Word) */}
                  <motion.div
                    className="flex-1"
                    variants={textContainerVariants}
                  >
                    {words.map((word, i) => (
                      <motion.span
                        key={word + i} // Unique key for each word span
                        variants={wordVariants}
                        className="text-sm font-sans font-medium text-white"
                        style={{
                          display: "inline-block",
                          marginRight: "4px",
                        }} // inline-block needed for y transform
                        whileHover={{
                          scale: 1.1,
                          color: "#4a90e2",
                          transition: { duration: 0.2 },
                        }}
                      >
                        {word}
                      </motion.span>
                    ))}
                  </motion.div>
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* Action Button */}
          {/* <motion.button
            onClick={handleRead}
            initial={{ opacity: 0, y: 30, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              duration: 0.8,
              ease: [0.25, 0.46, 0.45, 0.94],
              delay: 1.6,
            }}
            whileHover={{
              scale: 1.05,
              y: -3,
              boxShadow: "0 20px 40px rgba(74, 144, 226, 0.3)",
              transition: { duration: 0.2 },
            }}
            whileTap={{
              scale: 0.95,
              y: 0,
              transition: { duration: 0.1 },
            }}
            className="cursor-pointer px-6 py-2 bg-gradient-to-r from-[#4a90e2] to-[#5ba0f2] rounded-lg justify-center items-center flex text-white font-sans font-medium text-sm gap-x-2 hover:from-[#5ba0f2] hover:to-[#6bb3f7] transition-all duration-300 shadow-lg hover:shadow-xl relative overflow-hidden group"
          >
            <motion.span
              className="relative z-10 flex items-center gap-2"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 1.8 }}
            >
              See my actions
              <motion.div whileHover={{ x: 5 }} transition={{ duration: 0.2 }}>
                <IoIosArrowForward className="text-base" />
              </motion.div>
            </motion.span>


            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-[#5ba0f2] to-[#6bb3f7] opacity-0 group-hover:opacity-100"
              initial={{ x: "-100%" }}
              whileHover={{ x: "0%" }}
              transition={{ duration: 0.3 }}
            />
          </motion.button> */}
        </div>
      )}
    </div>
  );
};

export default Thoughts;
