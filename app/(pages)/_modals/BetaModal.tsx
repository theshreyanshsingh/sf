"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
// import { Spotlight } from '@/app/_components/Spotlight';
import Image from "next/image";
import logo from "@/app/assets/logo.png";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/app/redux/store";
import { JoinBeta, VerifyBeta } from "@/app/_services/login";
import { LuLoaderCircle } from "react-icons/lu";

import { unstable_batchedUpdates } from "react-dom";
import { setBetaModalOpen } from "@/app/redux/reducers/basicData";
import { setNotification } from "@/app/redux/reducers/NotificationModalReducer";

const BetaModal: React.FC = () => {
  const { BetaOpen } = useSelector((state: RootState) => state.basicData);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const dispatch = useDispatch();

  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState<number | undefined>();

  const onClose = () => {
    try {
      unstable_batchedUpdates(() => {
        setStep(1);
        setName("");
        setEmail("");
        setOtp(undefined);
        dispatch(setBetaModalOpen(false));
      });
    } catch (error) {
      console.log(error, "Error closing Login modal");
    }
  };

  //TODO
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOtp(Number(e.target.value));
  };

  const handleEmailPassLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    if (step === 1 && name.trim() && email.trim()) {
      const res = await JoinBeta({ email, name });
      if (res.success) {
        setStep(2);
      } else {
        dispatch(
          setNotification({
            modalOpen: true,
            status: "error",
            text: res.message,
          })
        );
      }
    } else if (
      step === 2 &&
      name.trim() &&
      email.trim() &&
      (otp?.toString() ?? "").trim().length >= 6
    ) {
      const res = await VerifyBeta({
        email,
        name,
        otp: otp !== undefined ? otp.toString() : "",
      });
      if (res.success) {
        unstable_batchedUpdates(() => {
          setName("");
          setEmail("");
          setOtp(undefined);
          setStep(3);
        });
      } else {
        dispatch(
          setNotification({
            modalOpen: true,
            status: "error",
            text: res.message,
          })
        );
      }
    } else {
      unstable_batchedUpdates(() => {
        setName("");
        setEmail("");
        setOtp(undefined);
        setStep(1);
        dispatch(setBetaModalOpen(false));
      });
    }
    setIsLoading(false);
  };

  if (!BetaOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-center justify-center overflow-hidden"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-xl bg-[#0A0A0D]  shadow-2xl md:mx-0 mx-3"
      >
        <div className="relative overflow-hidden">
          {/* Content */}
          <div className="relative p-6">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between text-balance flex-col space-y-3">
              <Image
                src={logo}
                alt="superblocks"
                width={40}
                height={40}
                className="rounded-md"
              />
              <p className="text-sm font-sans font-medium text-white text-center">
                Join 150+ devs, designers and founders who{" "}
                <span className="underline">love superblocks</span> — get beta
                access now!
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleEmailPassLogin} className="space-y-4">
              {step === 1 ? (
                <>
                  <div>
                    <label
                      htmlFor="name"
                      className="block text-sm font-medium text-white/70"
                    >
                      Name
                    </label>
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={handleNameChange}
                      required
                      className="text-xs font-sans font-medium mt-1 block w-full rounded-md border-white/10 bg-white/5 p-2  text-white placeholder-white/40 shadow-sm focus:border-none focus:outline-none"
                      placeholder="Your name"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-white/70"
                    >
                      Email
                    </label>
                    <input
                      disabled={isLoading}
                      id="email"
                      type="email"
                      value={email}
                      onChange={handleEmailChange}
                      required
                      className="text-xs font-sans font-medium mt-1 block w-full rounded-md border-white/10 bg-white/5 p-2  text-white placeholder-white/40 shadow-sm focus:border-none focus:outline-none"
                      placeholder="your@email.com"
                    />
                  </div>
                </>
              ) : step === 2 ? (
                <div className="space-y-2">
                  <p className="justify-center items-center text-balance font-sans font-medium text-sm text-[#949494] inline-block text-center gap-x-1">
                    An Otp has been sent to {email}.{" "}
                    <span
                      onClick={() => {
                        setStep(1);
                      }}
                      className="underline whitespace-nowrap inline-block"
                    >
                      Wrong email?
                    </span>
                  </p>
                  <label
                    htmlFor="otp"
                    className="block text-sm font-medium text-white/70"
                  >
                    Otp
                  </label>
                  <input
                    disabled={isLoading}
                    id="otp"
                    type="number"
                    value={otp}
                    maxLength={6}
                    onChange={handleOtpChange}
                    required
                    className="text-xs font-sans font-medium mt-1 block w-full rounded-md border-white/10 bg-white/5 p-2 text-white placeholder-white/40 shadow-sm focus:border-none focus:outline-none"
                    placeholder="6 digit otp"
                    style={{
                      WebkitAppearance: "none",
                      MozAppearance: "textfield",
                    }}
                  />
                </div>
              ) : step === 3 ? (
                <p className="block text-sm font-medium text-white/70 text-center text-balance">
                  Thank you. You will receive an email soon!
                  <br /> If not, you may check your spam folder.{" "}
                </p>
              ) : (
                <p className="block text-sm font-medium text-white/70 text-center">
                  Something went wrong! Please refresh.
                </p>
              )}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full justify-center items-center flex rounded-md bg-white px-4 py-2 font-medium text-black shadow-sm hover:bg-gray-100 focus:outline-none transition-colors font-sans text-xs"
              >
                {step === 1 ? (
                  isLoading ? (
                    <LuLoaderCircle className="text-black animate-spin text-sm" />
                  ) : (
                    "Request Beta Access"
                  )
                ) : step === 2 ? (
                  isLoading ? (
                    <LuLoaderCircle className="text-black animate-spin text-sm" />
                  ) : (
                    "Continue"
                  )
                ) : isLoading ? (
                  <LuLoaderCircle className="text-black animate-spin text-sm" />
                ) : (
                  "Close"
                )}
              </button>
              {(step === 1 || step === 2) && (
                <p className="text-center text-[11px] text-white font-sans font-medium">
                  No credit-card required!
                </p>
              )}
            </form>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default BetaModal;
