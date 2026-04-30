import React, { useEffect, useState } from "react";
import { Layout, Menu, Drawer, Button } from "antd";
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

const App = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const path = useHref();
  const dispatch = useDispatch();
  const [new_menu_data, setNew_menu_data] = useState([]);
  const { user } = useSelector((state) => state.authSlice);
  const isMobile = useIsMobile();

  const isHideLayout = HIDDEN_LAYOUT_ROUTES.some((route) =>
    path.includes(route),
  );

  useEffect(() => {
    if (!user) return;
    if (isSuperAdmin(user.role)) {
      setNew_menu_data(MENU_DATA);
    } else if (user.pagePermissions && user.pagePermissions.length > 0) {
      const accessiblePages = getAccessiblePages(user.pagePermissions);
      const filteredMenuData = MENU_DATA.reduce((acc, menu) => {
        const hasParentAccess = menu.special?.some((s) =>
          accessiblePages.includes(s),
        );
        if (!hasParentAccess) return acc;
        const menuCopy = { ...menu };
        if (menuCopy.children?.length) {
          menuCopy.children = menuCopy.children.filter((child) =>
            child.special?.some((s) => accessiblePages.includes(s)),
          );
        }
        acc.push(menuCopy);
        return acc;
      }, []);
      setNew_menu_data(filteredMenuData);
    } else {
      setNew_menu_data(
        MENU_DATA.filter((menu) => menu.for?.includes(user.role)),
      );
    }
  }, [user]);

  const fetchdata = async () => {
    try {
      const result = await checkloginstatus();
      const data = _.get(result, "data.data", "");
      dispatch(isLoginSuccess(data));
      if (_.isEmpty(data)) {
        localStorage.removeItem(admintoken);
        navigate("/");
      }
    } catch (err) {
      console.error("Login check failed:", err);
    }
  };

  useEffect(() => {
    fetchdata();
  }, []);

  const handleClick = (to) => {
    navigate(to);
    if (isMobile) setMobileDrawerOpen(false);
  };

  const selectedKey = (() => {
    const allItems = MENU_DATA.flatMap((menu) =>
      menu.children?.length ? menu.children : [menu],
    );
    const match = allItems.find((item) => path.includes(item.to));
    return match ? [String(match.id)] : [];
  })();

  const MenuContent = () => (
    <>
      <img
        src={IMAGE_HELPER.Dlogo}
        alt="logo"
        className="h-[42px] object-contain ml-3 my-3"
      />
      <Menu
        mode="inline"
        selectedKeys={selectedKey}
        className="pb-20 border-none"
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
          ),
        )}
      </Menu>
    </>
  );

  if (isHideLayout) return <Outlet />;

  return (
    <Layout style={{ height: "100vh" }}>
      {/* ── Desktop: Ant Sider ── */}
      {!isMobile && (
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          className="!h-screen !bg-white overflow-auto"
        >
          <MenuContent />
        </Sider>
      )}

      {/* ── Mobile: Drawer ── */}
      {isMobile && (
        <Drawer
          placement="left"
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          width={240}
          styles={{
            header: { display: "none" },
            body: { padding: 0, overflowX: "hidden" },
          }}
        >
          <MenuContent />
        </Drawer>
      )}

      <Layout className="!h-screen overflow-hidden">
        {/* ── Mobile hamburger bar — sits ABOVE TopNavbar ── */}
        {isMobile && (
          <div
            className="flex items-center px-3 h-[48px]   fixed top-3"
            style={{ zIndex: 10 }}
          >
            <Button
              type="text"
              icon={
                mobileDrawerOpen ? (
                  <CloseOutlined style={{ fontSize: 20 }} />
                ) : (
                  <MenuOutlined style={{ fontSize: 20 }} />
                )
              }
              onClick={() => setMobileDrawerOpen((prev) => !prev)}
            />
            <img
              src={IMAGE_HELPER.Dlogo}
              alt="logo"
              className="h-[32px] object-contain ml-3"
            />
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
