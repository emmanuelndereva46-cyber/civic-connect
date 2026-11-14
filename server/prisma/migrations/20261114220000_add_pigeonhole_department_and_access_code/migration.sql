ALTER TABLE `pigeonhole_submissions`
    ADD COLUMN `access_code_hash` VARCHAR(64) NULL,
    ADD COLUMN `department_id` INTEGER NULL;

CREATE INDEX `pigeonhole_submissions_department_id_idx`
    ON `pigeonhole_submissions` (`department_id`);

ALTER TABLE `pigeonhole_submissions`
    ADD CONSTRAINT `pigeonhole_submissions_department_id_fkey`
    FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;