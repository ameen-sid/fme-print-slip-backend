-- Migration Script: Add target_print_count to slip_data table
-- Purpose: Support the Multi-Print Quota feature

IF NOT EXISTS (
  SELECT * FROM sys.columns 
  WHERE object_id = OBJECT_ID('slip_data') AND name = 'target_print_count'
)
BEGIN
  ALTER TABLE slip_data ADD target_print_count INT DEFAULT 1;
  PRINT 'Column target_print_count added successfully.';
END
ELSE
BEGIN
  PRINT 'Column target_print_count already exists.';
END
GO
