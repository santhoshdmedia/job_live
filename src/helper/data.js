import _ from "lodash";
import { ICON_HELPER } from "./iconhelper";

export const MENU_DATA = [
  {
    id: 1,
    name: "Dashboard",
    icon: ICON_HELPER.HOME_ICON,
    to: "/dashboard",
    special: ["dashboard"],
    for: [
      "super admin",
      "accounting team",
      "designing team",
      "production team",
      "delivery team",
      "Frontend admin",
    ],
  },
  {
    id: 0,
    name: "site visit dashboard",
    icon: ICON_HELPER.HOME_ICON,
    to: "/site-visit-dashboard",
    special: ["site-visit-dashboard"],
    for: [
      "super admin",
      "accounting team",
      "designing team",
      "production team",
      "delivery team",
      "Frontend admin",
    ],
  },
  {
    id: 3,
    name: "my Jobs",
    icon: ICON_HELPER.ORDERS_ICON,
    to: "/my-jobs",
    special: ["my-jobs"],
    for: [
      "super admin",
      "accounting team",
      "designing team",
      "production team",
      "delivery team",
      "quality check",
      "packing team",
    ],
  },

  {
    id: 4,
    name: "Job Management",
    icon: ICON_HELPER.ORDERS_ICON,
    to: "/admin/job-management",
    special: ["admin-job-management"],
    for: ["super admin", "accounting team"],
  },
  {
    id: 5,
    name: "Designer Dashboard",
    icon: ICON_HELPER.ORDERS_ICON,
    to: "/admin/designer-job-dashboard",
    special: ["admin-designer-job-dashboard"],
    for: ["super admin", "designing team"],
  },
  {
    id: 6,
    name: "store manager",
    icon: ICON_HELPER.PRODUCT_ICON,
    to: "/material-issue-manager",
    special: ["material-issue-manager"],
    for: ["super admin", "store manager"],
  },
  {
    id: 21,
    name: "Pick up",
    icon: ICON_HELPER.HOME_ICON,
    to: "/pickup-dashboard",
    special: ["pickup-dashboard"],
    for: [
      "super admin",
      "accounting team",
      "designing team",
      "production team",
      "delivery team",
      "Frontend admin",
    ],
  },
  {
    id: 7,
    name: "Production Panel",
    icon: ICON_HELPER.BANNER_ICON,
    to: "/production-panel",
    special: ["production-panel"],
    for: ["super admin", "production team"],
  },
  {
    id: 8,
    name: "Quality Check",
    icon: ICON_HELPER.COUPON_ICON,
    to: "/quality-check",
    special: ["quality-check-dashboard"],
    for: ["super admin", "quality check"],
  },

  {
    id: 9,
    name: "Users",
    icon: ICON_HELPER.ADMIN_ICON,
    to: "/users",
    special: ["staff"],
    for: ["super admin"],
  },
  {
    id: 10,
    name: "delivery",
    icon: ICON_HELPER.ADMIN_ICON,
    to: "/delivery-panel",
    special: ["delivery-panel"],
    for: ["super admin"],
  },
  {
    id: 11,
    name: "erection",
    icon: ICON_HELPER.ADMIN_ICON,
    to: "/erection-panel",
    special: ["erection-panel"],
    for: ["super admin"],
  },
];

export const GET_DASHBOARD_COUNTS = (name, allCounts, others) => {
  try {
    const result = allCounts.filter((res) => {
      return res.name === name;
    });
    let labels = _.get(result, "[0].count", []).map((res) => {
      return _.get(res, "_id.type", "");
    });
    let count = _.get(result, "[0].count", []).map((res) => {
      return _.get(res, "total_products", 0);
    });
    if (others) {
      return [
        ["", ""],
        [labels[0], count[0]],
        [labels[1], count[1]],
      ];
    } else {
      return [
        ["", ...labels],
        ["", ...count],
      ];
    }
  } catch (err) {
    console.log(err);
  }
};

export const GET_DASHBOARD_SUB_COUNTS = (name, allCounts) => {
  try {
    const result = allCounts.filter((res) => {
      return res.name === name;
    });

    return _.get(result, "[0].count", 0);
  } catch (err) {
    console.log(err);
  }
};
