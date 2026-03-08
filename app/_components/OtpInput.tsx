import React, { useRef } from "react";

interface OtpInputProps {
  otp: string;
  email: string;
  handleOtpChange: (otp: string) => void;
  handleStep: (step: number) => void;
  disabled?: boolean;
}

const OtpInput: React.FC<OtpInputProps> = ({
  otp = "",
  handleOtpChange,
  disabled = false,
  email,
  handleStep,
}) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, value: string) => {
    const newValue = value.replace(/\D/g, ""); // Only allow numbers

    if (newValue) {
      const newOtp = otp.split("");
      newOtp[index] = newValue;

      const finalOtp = newOtp.join("").slice(0, 6);
      handleOtpChange(finalOtp); // Update parent state

      // Move focus to next input if available
      if (index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace") {
      // If current input is empty, move to previous input
      if (!otp[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
      // If current input has a value, clear it
      else if (otp[index]) {
        const newOtp = otp.split("");
        newOtp[index] = "";
        handleOtpChange(newOtp.join(""));

        // Optional: move focus to current input after clearing
        inputRefs.current[index]?.focus();
      }
    }
  };

  if (!email) {
    handleStep(1);
  }

  return (
    <div className="w-full max-w-md mx-auto px-2">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-white mb-2">
          OTP Verification
        </h2>
        <p className="text-sm text-gray-400 mb-1">
          We have sent a 6-digit OTP to
        </p>
        <p className="text-sm font-medium text-blue-400 mb-3">{email}</p>
        <button
          onClick={() => {
            handleStep(1);
            handleOtpChange("");
          }}
          className="text-sm text-blue-400 hover:text-blue-300 underline transition-colors duration-200"
        >
          Change email
        </button>
      </div>

      <div className="flex items-center justify-center space-x-3 w-full">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="relative">
            <input
              autoFocus={index === 0}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              maxLength={1}
              className={`
                w-12 h-12 sm:w-14 sm:h-14
                text-center 
                rounded-xl 
                bg-gradient-to-br from-[#1A1A1E] to-[#0F0F0F]
                text-white 
                text-lg sm:text-xl
                font-bold 
                border-2 border-[#2a2a2a]
                focus:outline-none 
                focus:border-blue-500
                focus:ring-2 focus:ring-blue-500/20
                transition-all duration-200
                hover:border-[#3a3a3a]
                disabled:opacity-50 disabled:cursor-not-allowed
                ${otp[index] ? "border-blue-500 bg-gradient-to-br from-blue-500/10 to-purple-500/10" : ""}
                ${disabled ? "opacity-50" : "animate-pulse"}
              `}
              value={otp[index] || ""}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onFocus={(e) => {
                e.target.select();
              }}
              disabled={disabled}
              placeholder="•"
            />
            {/* Animated border effect */}
            {otp[index] && (
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 animate-pulse" />
            )}
          </div>
        ))}
      </div>

      {/* Progress indicator */}
      <div className="mt-6 flex justify-center">
        <div className="flex space-x-1">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index < otp.length ? "bg-blue-500 scale-125" : "bg-gray-600"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Resend OTP button */}
      <div className="mt-4 text-center">
        <button
          className="text-sm text-gray-400 hover:text-white transition-colors duration-200"
          onClick={() => {
            // Add resend OTP logic here
            console.log("Resend OTP");
          }}
        >
          Didn't receive the code?{" "}
          <span className="text-blue-400 hover:text-blue-300 underline">
            Resend
          </span>
        </button>
      </div>
    </div>
  );
};

export default OtpInput;
