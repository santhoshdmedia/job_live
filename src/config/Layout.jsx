import React, { useEffect, useState } from "react";
import { Layout, Menu, Drawer, Button, Spin, Tooltip } from "antd";
import { Outlet, useHref, useNavigate } from "react-router-dom";
import { MENU_DATA } from "../helper/data";
import _ from "lodash";
import { isLoginSuccess } from "../redux/slices/authSlice";
import { admintoken } from "../helper/notification_helper";
import { checkloginstatus } from "../api";
import { useDispatch, useSelector } from "react-redux";
import TopNavbar from "../components/TopNavbar";
import { IMAGE_HELPER } from "../helper/imagehelper";
import { getAccessiblePages, isSuperAdmin } from "../helper/permissionHelper";
import { MenuOutlined, CloseOutlined } from "@ant-design/icons";

const { Sider } = Layout;

const HIDDEN_LAYOUT_ROUTES = ["product-catalog"];

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return isMobile;
};

/** Lightweight branded loading screen instead of a bare centered spinner */
const AuthLoadingScreen = () => (
  <div
    className="flex flex-col items-center justify-center h-screen gap-4"
    style={{ background: "#FAFBFC" }}
  >
    <img
      src={IMAGE_HELPER.Dfav}
      alt=""
      className="h-10 w-10 object-contain animate-[softPulse_1.6s_ease-in-out_infinite]"
    />
    <Spin size="large" />
    <span className="text-xs text-slate-400 tracking-wide">Loading your workspace…</span>
    <style>{`
      @keyframes softPulse {
        0%, 100% { opacity: 0.5; transform: scale(0.96); }
        50%      { opacity: 1;   transform: scale(1); }
      }
    `}</style>
  </div>
);

const App = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const navigate = useNavigate();
  const path = useHref();
  const dispatch = useDispatch();
  const [new_menu_data, setNew_menu_data] = useState([]);
  const { user } = useSelector((state) => state.authSlice);
  const isMobile = useIsMobile();

  const isHideLayout = HIDDEN_LAYOUT_ROUTES.some((route) =>
    path.includes(route)
  );

  // Build menu based on role/permissions whenever user changes
  useEffect(() => {
    if (!user) return;

    if (isSuperAdmin(user.role)) {
      setNew_menu_data(MENU_DATA);
    } else if (user.pagePermissions?.length > 0) {
      const accessiblePages = getAccessiblePages(user.pagePermissions);
      const filteredMenuData = MENU_DATA.reduce((acc, menu) => {
        const hasParentAccess = menu.special?.some((s) =>
          accessiblePages.includes(s)
        );
        if (!hasParentAccess) return acc;
        const menuCopy = { ...menu };
        if (menuCopy.children?.length) {
          menuCopy.children = menuCopy.children.filter((child) =>
            child.special?.some((s) => accessiblePages.includes(s))
          );
        }
        acc.push(menuCopy);
        return acc;
      }, []);
      setNew_menu_data(filteredMenuData);
    } else {
      setNew_menu_data(
        MENU_DATA.filter((menu) => menu.for?.includes(user.role))
      );
    }
  }, [user]);

  // Check login status on mount — redirect to "/" if not authenticated
  useEffect(() => {
    const fetchdata = async () => {
      try {
        const result = await checkloginstatus();
        const data = _.get(result, "data.data", "");
        if (_.isEmpty(data)) {
          localStorage.removeItem(admintoken);
          navigate("/", { replace: true });
        } else {
          dispatch(isLoginSuccess(data));
        }
      } catch (err) {
        console.error("Login check failed:", err);
        localStorage.removeItem(admintoken);
        navigate("/", { replace: true });
      } finally {
        setAuthChecked(true);
      }
    };

    fetchdata();
  }, []);

  // Close mobile drawer automatically if the viewport grows past the mobile breakpoint
  useEffect(() => {
    if (!isMobile) setMobileDrawerOpen(false);
  }, [isMobile]);

  const handleClick = (to) => {
    navigate(to);
    if (isMobile) setMobileDrawerOpen(false);
  };

  const selectedKey = (() => {
    const allItems = MENU_DATA.flatMap((menu) =>
      menu.children?.length ? menu.children : [menu]
    );
    const match = allItems.find((item) => path.includes(item.to));
    return match ? [String(match.id)] : [];
  })();

  // Which submenu (if any) contains the active item — keep it expanded by default
  const openKey = (() => {
    const parent = MENU_DATA.find((menu) =>
      menu.children?.some((c) => path.includes(c.to))
    );
    return parent ? [String(parent.id)] : [];
  })();

  // Block render until auth check completes — prevents wildcard redirect race
  if (!authChecked) {
    return <AuthLoadingScreen />;
  }

  const MenuContent = ({ inDrawer = false }) => (
    <>
      <div
        className={`flex items-center ${
          collapsed && !inDrawer ? "justify-center px-0" : "px-4"
        } h-[64px] border-b shrink-0`}
        style={{ borderColor: "#F1F5F9" }}
      >
        <img
          src={collapsed && !inDrawer ? IMAGE_HELPER.Dfav : IMAGE_HELPER.Dlogo}
          alt="logo"
          className={collapsed && !inDrawer ? "h-8 object-contain" : "h-[36px] object-contain"}
        />
      </div>

      <Menu
        mode="inline"
        selectedKeys={selectedKey}
        defaultOpenKeys={openKey}
        className="pb-20 border-none"
        style={{ paddingTop: 8 }}
      >
        {new_menu_data.map((res) =>
          !_.isEmpty(_.get(res, "children", [])) ? (
            <Menu.SubMenu
              key={res.id}
              title={res.name}
              icon={React.createElement(res.icon)}
            >
              {res.children.map((child) => (
                <Menu.Item key={child.id} onClick={() => handleClick(child.to)}>
                  {child.name}
                </Menu.Item>
              ))}
            </Menu.SubMenu>
          ) : (
            <Menu.Item
              key={res.id}
              onClick={() => handleClick(res.to)}
              icon={React.createElement(res.icon)}
            >
              {res.name}
            </Menu.Item>
          )
        )}
      </Menu>
    </>
  );

  if (isHideLayout) return <Outlet />;

  return (
    <Layout style={{ height: "100vh" }}>
      {/* Desktop: Ant Sider */}
      {!isMobile && (
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          width={232}
          className="!h-screen !bg-white overflow-auto flex flex-col"
          style={{
            borderRight: "1px solid #F1F5F9",
            boxShadow: "1px 0 0 rgba(15,23,42,0.02)",
          }}
        >
          <MenuContent />
        </Sider>
      )}

      {/* Mobile: Drawer */}
      {isMobile && (
        <Drawer
          placement="left"
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          width={252}
          closeIcon={null}
          styles={{
            header: { display: "none" },
            body: { padding: 0, overflowX: "hidden", display: "flex", flexDirection: "column" },
          }}
        >
          <MenuContent inDrawer />
        </Drawer>
      )}

      {/* Backdrop dim for mobile drawer (extra visual separation from content) */}
      {isMobile && mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-30"
          style={{ background: "rgba(15,23,42,0.25)" }}
          onClick={() => setMobileDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      <Layout
        className="!h-screen overflow-hidden"
        style={{
          background: "#F8FAFC",
          "--mobile-topbar-offset": isMobile ? "52px" : "0px",
        }}
      >
        {/* Mobile hamburger bar */}
        {isMobile && (
          <div
            className="flex items-center justify-between px-3 h-[52px] fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-md border-b"
            style={{ zIndex: 35, borderColor: "#F1F5F9" }}
          >
            <div className="flex items-center gap-1">
              <Tooltip title={mobileDrawerOpen ? "Close menu" : "Open menu"}>
                <Button
                  type="text"
                  shape="circle"
                  aria-label={mobileDrawerOpen ? "Close menu" : "Open menu"}
                  icon={
                    mobileDrawerOpen ? (
                      <CloseOutlined style={{ fontSize: 18 }} />
                    ) : (
                      <MenuOutlined style={{ fontSize: 18 }} />
                    )
                  }
                  onClick={() => setMobileDrawerOpen((prev) => !prev)}
                  style={{
                    width: 36,
                    height: 36,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                />
              </Tooltip>
              <img
                src={IMAGE_HELPER.Dfav}
                alt="logo"
                className="h-7 object-contain ml-1"
              />
            </div>
          </div>
        )}

        <TopNavbar />

        <div className="!h-screen overflow-auto">
          <Outlet />
        </div>
      </Layout>
    </Layout>
  );
};

export default App;