import { Table } from "antd";
import _ from "lodash";
import React, { useEffect, useState } from "react";

const CustomTable = ({ 
  dataSource = [], 
  columns = [], 
  filter = [], 
  loading, 
  padding = true,
  pagination = {},
  onChange,
  scroll = { x: 800 },
  className = ""
}) => {
  const [availableColumns, setAvailableColumns] = useState(columns);
  const [dummy, setDummy] = useState(false);

  useEffect(() => {
    if (!_.isEmpty(filter)) {
      const filteredColumns = columns?.filter((res) => {
        return !filter.includes(res.title);
      });
      setAvailableColumns(filteredColumns);
      setDummy(!dummy);
    }
  }, [filter, columns]);

  // Default pagination configuration
  const defaultPagination = {
    pageSize: 10,
    position: ["bottomCenter"],
    size: "small",
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
  };

  // Merge default pagination with provided pagination
  const tablePagination = pagination ? { 
    ...defaultPagination, 
    ...pagination 
  } : false;

  return (
    <div className={`bg-white ${padding ? "p-5" : "py-5"} rounded-lg ${className}`}>
      <Table 
        scroll={scroll} 
        loading={loading} 
        dataSource={dataSource} 
        columns={availableColumns} 
        pagination={tablePagination}
        onChange={onChange}
        rowKey={(record) => record._id || record.id || Math.random().toString()}
      />
    </div>
  );
};

export default CustomTable;