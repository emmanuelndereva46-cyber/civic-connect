import { Routes, Route, useLocation } from "react-router-dom";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import CitizenDashboard from "./pages/CitizenDashboard.jsx";
import ReportIssue from "./pages/ReportIssue.jsx";
import ReportDetail from "./pages/ReportDetail.jsx";
import Pigeonhole from "./pages/Pigeonhole.jsx";
import TrackReport from "./pages/TrackReport.jsx";
import Notifications from "./pages/Notifications.jsx";
import Profile from "./pages/Profile.jsx";
import OfficerDashboard from "./pages/OfficerDashboard.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import NotFound from "./pages/NotFound.jsx";
import AnimatedBackground from "./components/AnimatedBackground.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

export default function App() {
  const location = useLocation();
  return (
    <>
    <AnimatedBackground />
    <div key={location.pathname} className="page-enter relative z-10">
    <Routes location={location}>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/pigeonhole" element={<Pigeonhole />} />
      <Route path="/track" element={<TrackReport />} />
      <Route path="/report/new" element={<ReportIssue />} />

      <Route path="/dashboard" element={
        <ProtectedRoute roles={["CITIZEN"]}><CitizenDashboard /></ProtectedRoute>
      } />
      <Route path="/reports/:id" element={
        <ProtectedRoute roles={["CITIZEN", "OFFICER", "ADMIN"]}><ReportDetail /></ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute roles={["CITIZEN"]}><Profile /></ProtectedRoute>
      } />
      <Route path="/notifications" element={
        <ProtectedRoute roles={["CITIZEN", "OFFICER", "ADMIN"]}><Notifications /></ProtectedRoute>
      } />

      <Route path="/officer" element={
        <ProtectedRoute roles={["OFFICER"]}><OfficerDashboard /></ProtectedRoute>
      } />
      <Route path="/admin" element={
        <ProtectedRoute roles={["ADMIN"]}><AdminDashboard /></ProtectedRoute>
      } />

      <Route path="*" element={<NotFound />} />
    </Routes>
    </div>
    </>
  );
}
