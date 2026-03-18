"use client";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { IoIosAdd } from "react-icons/io";
import { GoProjectRoadmap } from "react-icons/go";
import { useAuthenticated } from "../helpers/useAuthenticated";

import { useRouter } from "next/navigation";

const Sidebar = () => {
  // const [isHovered, setIsHovered] = useState(false);

  const options = [
    { title: "Add", icon: IoIosAdd },
    { title: "Projects", icon: GoProjectRoadmap },
  ];

  const { email } = useAuthenticated();

  const router = useRouter();

  return (
    <>
      {/* Sidebar (Visible on Desktop) */}
      <motion.div
        className="hidden md:flex flex-col border-r bg-[#0F0F0F] md:w-[3vw] w-auto border-[#201F22] p-3 space-y-10  justify-between h-screen transition-all"
        initial={{ filter: "brightness(1)" }}
        // onMouseEnter={() => setIsHovered(true)}
        // onMouseLeave={() => setIsHovered(false)}
      >
        <div className="space-y-10">
          {/* Logo */}
          <Link href="/" className="flex items-center group">
            <div className="relative w-7 h-7 transform transition-transform">
              <Image
                src="/logo.svg"
                alt="Logo"
                fill
                className="object-contain"
              />
            </div>
          </Link>

          {/* Options with Hover Effect */}
          <div className="flex flex-col justify-center items-center gap-y-7 relative">
            {options.map((O, i) => (
              <motion.div
                key={i}
                whileHover={{ scale: 1.1, filter: "brightness(1.3)" }}
                transition={{ duration: 0.2 }}
                className="cursor-pointer hover:bg-[#2b2a2d] rounded-md p-1"
                onClick={() => {
                  if (O.title === "Projects") {
                    router.push("/projects");
                    // dispatch(fetchAllProjects({ email: email.value || "" }));
                    // setActiveIndex(i);
                  } else {
                    router.push("/");
                  }
                }}
              >
                <O.icon className="text-lg text-white" />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom Icons */}
        <div className="flex flex-col justify-center items-center gap-y-4">
          {/* settings */}
          {/* <motion.button
            whileHover={{ scale: 1.1, filter: "brightness(1.3)" }}
            transition={{ duration: 0.2 }}
            className="ustify-center items-center flex cursor-pointer hover:bg-[#2b2a2d] rounded-md p-1"
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 0.5, scaleX: 1 }}
          >
            <IoSettingsOutline className="text-lg text-white" />
          </motion.button> */}
          {/* Id */}
          <motion.button
            onClick={() => {
              router.push("/projects/settings");
            }}
            whileHover={{ scale: 1.1, filter: "brightness(1.3)" }}
            transition={{ duration: 0.2 }}
            className=" p-1 justify-center items-center flex cursor-pointer"
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 0.5, scaleX: 1 }}
          >
            {email.value !== null &&
            email.value !== undefined &&
            typeof email.value === "string" ? (
              email.value.charAt(0).toUpperCase()
            ) : (
              <div className="p-3 bg-[#252527] rounded-lg " />
            )}
          </motion.button>
        </div>
      </motion.div>

      {/* Mobile Header with Icons */}
      <motion.div
        className="md:hidden w-full bg-[#0F0F0F] border-b border-[#201F22] z-40 flex justify-between items-center"
        initial={{ y: -50 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Link href="/" className="flex items-center p-2">
          <div className="relative w-6 h-6">
            <Image src="/logo.svg" alt="Logo" fill className="object-contain" />
          </div>
        </Link>
        <div className="flex items-center gap-x-2 mr-3">
          {options.map((O, i) => (
            <motion.div
              key={i}
              whileHover={{ scale: 1.1, filter: "brightness(1.3)" }}
              transition={{ duration: 0.2 }}
              className=" cursor-pointer hover:bg-white hover:text-black p-2"
              onClick={() => {
                if (O.title === "Projects") {
                  router.push("/projects");
                } else {
                  router.push("/");
                }
              }}
            >
              <O.icon className="text-lg text-white" />
            </motion.div>
          ))}
          <motion.button
            onClick={() => {
              router.push("/projects/settings");
            }}
            whileHover={{ scale: 1.1, filter: "brightness(1.3)" }}
            transition={{ duration: 0.2 }}
            className=" justify-center items-center flex cursor-pointer bg-[#252527] rounded-md ml-2  px-2 text-white"
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 0.5, scaleX: 1 }}
          >
            {email.value !== null &&
            email.value !== undefined &&
            typeof email.value === "string" ? (
              email.value.charAt(0).toUpperCase()
            ) : (
              <div className="p-3 bg-[#252527] rounded-lg " />
            )}
          </motion.button>
        </div>
      </motion.div>
    </>
  );
};

export default Sidebar;
