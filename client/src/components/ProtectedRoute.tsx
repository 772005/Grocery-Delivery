import { Navigate, Outlet } from "react-router-dom";

const ProtectedRoute = () => {
  // Check if user token exists in localStorage
  const token = localStorage.getItem("authToken");

  // If no token, redirect to login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // If authenticated, render the protected routes
  return <Outlet />;
};

export default ProtectedRoute;
