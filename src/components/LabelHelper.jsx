import React from "react";

export const LabelHelper = ({ title, white = false }) => {
  return <h1 className={`capitalize tracking-wider !font-primary_font ${!white ? "!text-secondary" : "!text-white"}  !font-medium`}>{title}</h1>;
};
