/* eslint-disable react/prop-types */
const CustomLabel = ({ name }) => {
  return (
    <div>
      <span className="text-red-500">*</span> {name}
    </div>
  );
};

export default CustomLabel;
