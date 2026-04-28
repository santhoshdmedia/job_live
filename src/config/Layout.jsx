import React, { useEffect, useState } from "react";
import { Layout, Menu, Drawer, Button } from "antd";
import { MenuOutlined } from "@ant-design/icons";
import { Outlet, useHref, useNavigate } from "react-router-dom";
import { MENU_DATA } from "../helper/data";
import _ from "lodash";
import { isLoginSuccess } from "../redux/slices/authSlice";
import { admintoken } from "../helper/notification_helper";
import { checkloginstatus } from "../api";
import { useDispatch, useSelector } from "react-redux";
import TopNavbar from "../components/TopNavbar";
import { canViewPage, getAccessiblePages, isSuperAdmin } from "../helper/permissionHelper";
import { IMAGE_HELPER } from "../helper/imagehelper";

const { Sider } = Layout;

const HIDDEN_LAYOUT_ROUTES = ["product-catalog"];

// Custom hook to detect mobile screen width
const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    window.addEventListener("resize", listener);
    return () => window.removeEventListener("resize", listener);
  }, [matches, query]);

  return matches;
};

const App = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerVisible, setMobileDrawerVisible] = useState(false);
  const navigate = useNavigate();
  const path = useHref();
  const dispatch = useDispatch();
  const [new_menu_data, setNew_menu_data] = useState([]);
  const { user } = useSelector((state) => state.authSlice);
  const [openKeys, setOpenKeys] = useState([]);

  const isMobile = useMediaQuery("(max-width: 768px)");
  const isHideLayout = HIDDEN_LAYOUT_ROUTES.some((route) => path.includes(route));

  // Menu filtering logic (unchanged)
  useEffect(() => {
    if (isSuperAdmin(user.role)) {
      setNew_menu_data(MENU_DATA);
    } else if (user.pagePermissions && user.pagePermissions.length > 0) {
      const accessiblePages = getAccessiblePages(user.pagePermissions);
      const filteredMenuData = MENU_DATA.filter((menu) => {
        if (menu.children && menu.children.length > 0) {
          menu.children = menu.children.filter((child) =>
            child.special.some((special) => accessiblePages.includes(special))
          );
        }
        return true;
      });
      setNew_menu_data(filteredMenuData);
    } else {
      const updatedMenuData = MENU_DATA.filter((menu) =>
        menu.for.includes(user.role)
      );
      setNew_menu_data(updatedMenuData);
    }
  }, [user]);

  // Auth check (unchanged)
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

  const handleMenuClick = (to) => {
    navigate(to);
    if (isMobile) setMobileDrawerVisible(false);
  };

  const renderMenuItems = () => (
    <Menu mode="inline" className="pb-20">
      {new_menu_data.map((res) =>
        !_.isEmpty(_.get(res, "children", [])) ? (
          <Menu.SubMenu
            key={res.id}
            title={res.name}
            icon={React.createElement(res.icon)}
          >
            {res.children.map((child) => (
              <Menu.Item key={child.id} onClick={() => handleMenuClick(child.to)}>
                {child.name}
              </Menu.Item>
            ))}
          </Menu.SubMenu>
        ) : (
          <Menu.Item
            key={res.id}
            onClick={() => handleMenuClick(res.to)}
            icon={React.createElement(res.icon)}
          >
            {res.name}
          </Menu.Item>
        )
      )}
    </Menu>
  );

  if (isHideLayout) return <Outlet />;

  return (
    <Layout className="w-full">
      {/* Fixed Top Navbar */}
      <div className="h-[64px] w-full bg-white shadow fixed top-0 z-50">
        <TopNavbar />
      </div>
      <div className="fixed top-0 z-50">

      {/* Mobile Hamburger Button – hidden when drawer is open to avoid z-index conflict */}
      {isMobile && !mobileDrawerVisible && (
        <Button
          type="text"
          icon={<MenuOutlined />}
          onClick={() => setMobileDrawerVisible(true)}
          className="!bg-white"
          style={{
            position: "fixed !important",
            top: 20,
            left: 16,
            zIndex: 1001,
            fontSize: 18,
            color: "#333",
          }}
        />
      )}
      </div>

      {/* Desktop Sider */}
      {!isMobile && (
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          className=" !bg-white h-screen overflow-auto pt-20 !fixed left-0 top-0 z-40"
        >
          {renderMenuItems()}
        </Sider>
      )}

      {/* Mobile Drawer – explicit zIndex to stay above everything */}
      
      <Drawer
        title="Navigation"
        placement="left"
        closable={true}
        onClose={() => setMobileDrawerVisible(false)}
        open={mobileDrawerVisible}
        width={250}
        bodyStyle={{ padding: 0 }}
        headerStyle={{ borderBottom: "1px solid #f0f0f0" }}
        zIndex={1050}
        getContainer={false}
        className=""
      >
        {renderMenuItems()}
      </Drawer>

      {/* Main Content Area */}
      <div
        className="w-full p-4 pt-24"
        style={{
          marginLeft: !isMobile && !collapsed ? 200 : !isMobile && collapsed ? 80 : 0,
          transition: "margin-left 0.2s",
        }}
      >
        <Outlet />
      </div>
    </Layout>
  );
};

export default App;
