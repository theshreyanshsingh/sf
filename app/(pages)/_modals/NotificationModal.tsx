"use client";
import { setNotification } from "@/app/redux/reducers/NotificationModalReducer";
import { RootState } from "@/app/redux/store";
import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { MdInfoOutline } from "react-icons/md";
import { RxCross2 } from "react-icons/rx";
import { FaCheck } from "react-icons/fa6";
import { motion, AnimatePresence } from "framer-motion";

const NotificationModal = () => {
  const { modalOpen, text, status } = useSelector(
    (state: RootState) => state.notificaitonprovider
  );
  const dispatch = useDispatch();

  useEffect(() => {
    if (modalOpen) {
      const timer = setTimeout(() => {
        dispatch(
          setNotification({ status: null, text: null, modalOpen: false })
        );
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [modalOpen, dispatch]);

  return (
    <AnimatePresence mode="wait">
      {modalOpen && (
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -30 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="fixed top-12 left-1/2 -translate-x-1/2 z-50 p-1 px-2 bg-[#1d2329] text-white text-xs font-medium font-sans rounded-lg flex items-center gap-x-2 shadow-md"
        >
          {status === "success" ? (
            <FaCheck className="text-sm text-emerald-400" />
          ) : status === "error" ? (
            <RxCross2 className="text-sm text-red-400" />
          ) : status === "info" ? (
            <MdInfoOutline className="text-sm text-white" />
          ) : null}
          {text}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NotificationModal;
