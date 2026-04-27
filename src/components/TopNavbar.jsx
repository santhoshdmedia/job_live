import { useState } from "react";
import { Avatar, Divider, Button, Tooltip } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { ICON_HELPER } from "../helper/iconhelper";
import { IMAGE_HELPER } from "../helper/imagehelper";
import { useDispatch, useSelector } from "react-redux";
import React from "react";
import { isLoginSuccess } from "../redux/slices/authSlice";
import { useNavigate } from "react-router-dom";
import CreateJobModal from "./job/CreateJobModal";

function getGreeting(name = "") {
  const hour = new Date().getHours();
  let greet = "";
  if (hour < 12) greet = "Good Morning";
  else if (hour < 17) greet = "Good Afternoon";
  else if (hour < 21) greet = "Good Evening";
  else greet = "Good Night";
  return name ? `${greet}, ${name}! 👋` : greet;
}
function MobileGetGreeting(name = "") {
  const hour = new Date().getHours();
  let greet = "";
  if (hour < 12) greet = "Gud Mrng";
  else if (hour < 17) greet = "Gud Afternoon";
  else if (hour < 21) greet = "Gud Evng";
  else greet = "Gud Nyt";
  return name ? `${greet}, ${name}! 👋` : greet;
}

const TopNavbar = ({ jobs = [], onJobCreated }) => {
  const { user } = useSelector((state) => state.authSlice);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [createOpen, setCreateOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    dispatch(isLoginSuccess({}));
    navigate("/");
  };

  return (
    <>
      <div className="group flex items-center justify-between px-6 py-4 bg-white border-b">
        <div className="lg:block hidden">
          <img src={IMAGE_HELPER.Dlogo} alt="Logo" className="h-10 w-auto" />
        </div>
        <div className="lg:hidden block ml-10">
          <img src={IMAGE_HELPER.Dfav} alt="Logo" className="h-10 w-auto" />
        </div>
        

        {/* Right section */}
        <div className="flex items-center gap-x-3">
          {/* ── New Job button ── */}
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
            style={{
              background: "#2563eb",
              border: "none",
              borderRadius: 8,
              fontWeight: 600,
              height: 36,
            }}
          >
            New Job
          </Button>

          {/* Profile avatar (placeholder) */}
          {/* <div className="center_div gap-x-2 font-medium text-secondary">
            <Avatar size="medium" className="bg-blue-500 text-black">
              {user?.name?.[0]?.toUpperCase() || "A"}
            </Avatar>
          </div> */}

          {/* Logout */}
          <div
            className="center_div gap-x-2 cursor-pointer font-medium text-secondary"
            onClick={handleLogout}
          >
            <Tooltip title="Logout">
              <Avatar size="medium">
                <ICON_HELPER.Logout className="!text-secondary" />
              </Avatar>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Create Job Modal — lives here, triggered from navbar */}
      <CreateJobModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          onJobCreated?.(); // bubble up so parent tables can refresh
        }}
        existingJobs={jobs}
      />
    </>
  );
};

export default TopNavbar;
