// "use client";

// import React from "react";
// import { LuLoaderCircle } from "react-icons/lu";
// import { useSubscriptionStatus } from "@/app/helpers/useSubscriptionStatus";
// import { useRouter } from "next/navigation";

// interface PaymentVerificationProps {
//   customerSessionToken: string | null;
//   children: React.ReactNode;
// }

// const PaymentVerification: React.FC<PaymentVerificationProps> = ({
//   customerSessionToken,
//   children,
// }) => {
//   const router = useRouter();
//   const { isLoading, error, subscriptionData } =
//     useSubscriptionStatus(customerSessionToken);

//   // Use useEffect for navigation instead of doing it during render
//   React.useEffect(() => {
//     if (!isLoading && (error || !subscriptionData)) {
//       router.push("/projects/settings");
//     }
//   }, [isLoading, error, subscriptionData, router]);

//   if (isLoading) {
//     return (
//       <div className="flex justify-center items-center p-4">
//         <LuLoaderCircle className="text-white text-xl animate-spin" />
//         <p className="text-white text-sm font-sans font-medium ml-2">
//           Verifying subscription...
//         </p>
//       </div>
//     );
//   }

//   // Don't attempt to navigate during render
//   if (error || !subscriptionData) {
//     return null;
//   }

//   return <>{children}</>;
// };

// export default PaymentVerification;
